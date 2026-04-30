-- Fix tournament scoring/finalization:
-- 1. Apply tournament points when match_results arrive after the match status update.
-- 2. Reconcile already-finished tournament matches that were missed by the old trigger.
-- 3. Finalize timed-out tournaments more robustly and clean up active match links.

-- ---------------------------------------------------------------------
-- Helper: apply a finalized tournament match result exactly once
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_apply_match_result(p_match_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match matches%ROWTYPE;
  v_result match_results%ROWTYPE;
  v_winner_pid UUID;
  v_loser_pid UUID;
  v_updated INTEGER := 0;
BEGIN
  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND OR v_match.tournament_id IS NULL THEN
    RETURN false;
  END IF;

  -- Idempotency guard: only score matches that still have participants linked
  IF NOT EXISTS (
    SELECT 1
    FROM tournament_participants
    WHERE tournament_id = v_match.tournament_id
      AND current_match_id = p_match_id
  ) THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_result
  FROM match_results
  WHERE match_id = p_match_id
    AND (winner_user_id IS NOT NULL OR winner_team_id IS NOT NULL)
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_result.winner_team_id IS NOT NULL THEN
    SELECT id INTO v_winner_pid
    FROM tournament_participants
    WHERE tournament_id = v_match.tournament_id
      AND team_id = v_result.winner_team_id
      AND current_match_id = p_match_id
    LIMIT 1;
  ELSIF v_result.winner_user_id IS NOT NULL THEN
    SELECT id INTO v_winner_pid
    FROM tournament_participants
    WHERE tournament_id = v_match.tournament_id
      AND user_id = v_result.winner_user_id
      AND current_match_id = p_match_id
    LIMIT 1;
  END IF;

  IF v_winner_pid IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO v_loser_pid
  FROM tournament_participants
  WHERE tournament_id = v_match.tournament_id
    AND current_match_id = p_match_id
    AND id <> v_winner_pid
  LIMIT 1;

  UPDATE tournament_participants
    SET points = points + 3,
        wins = wins + 1,
        matches_played = matches_played + 1,
        current_match_id = NULL
  WHERE id = v_winner_pid
    AND current_match_id = p_match_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_loser_pid IS NOT NULL THEN
    UPDATE tournament_participants
      SET losses = losses + 1,
          matches_played = matches_played + 1,
          current_match_id = NULL
    WHERE id = v_loser_pid
      AND current_match_id = p_match_id;
  END IF;

  UPDATE tournament_participants
    SET current_match_id = NULL
  WHERE tournament_id = v_match.tournament_id
    AND current_match_id = p_match_id;

  PERFORM public.tournament_pair_idle(v_match.tournament_id);

  RETURN v_updated > 0;
END;
$$;

-- ---------------------------------------------------------------------
-- Helper: reconcile any already-finished tournament matches that were missed
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_reconcile_finished_matches(p_tournament_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_applied INTEGER := 0;
BEGIN
  FOR v_match IN
    SELECT m.id
    FROM matches m
    WHERE m.tournament_id = p_tournament_id
      AND m.status IN ('completed', 'finished', 'admin_resolved')
      AND EXISTS (
        SELECT 1
        FROM tournament_participants tp
        WHERE tp.tournament_id = p_tournament_id
          AND tp.current_match_id = m.id
      )
    ORDER BY m.updated_at ASC NULLS LAST, m.finished_at ASC NULLS LAST, m.created_at ASC
  LOOP
    IF public.tournament_apply_match_result(v_match.id) THEN
      v_applied := v_applied + 1;
    END IF;
  END LOOP;

  RETURN v_applied;
END;
$$;

-- ---------------------------------------------------------------------
-- Trigger: tournament_on_match_completed
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_on_match_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tournament_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('completed', 'finished', 'admin_resolved') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  PERFORM public.tournament_apply_match_result(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_match_completed_trigger ON public.matches;
CREATE TRIGGER tournament_match_completed_trigger
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  WHEN (NEW.tournament_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.tournament_on_match_completed();

-- ---------------------------------------------------------------------
-- Trigger: tournament_on_match_result_changed
-- Catches the current finalize order where match_results is written after
-- the match status has already been flipped to finished.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_on_match_result_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_id UUID;
BEGIN
  SELECT tournament_id INTO v_tournament_id
  FROM matches
  WHERE id = NEW.match_id;

  IF v_tournament_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.winner_user_id IS NULL AND NEW.winner_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM public.tournament_apply_match_result(NEW.match_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tournament_match_result_trigger ON public.match_results;
CREATE TRIGGER tournament_match_result_trigger
  AFTER INSERT OR UPDATE ON public.match_results
  FOR EACH ROW
  EXECUTE FUNCTION public.tournament_on_match_result_changed();

-- ---------------------------------------------------------------------
-- RPC: tournament_finalize
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_finalize(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament tournaments%ROWTYPE;
  v_position RECORD;
  v_participant RECORD;
  v_winner_user UUID;
  v_paid_count INTEGER := 0;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  PERFORM public.tournament_reconcile_finished_matches(p_tournament_id);

  FOR v_position IN
    SELECT position, amount FROM tournament_prize_positions
    WHERE tournament_id = p_tournament_id
    ORDER BY position ASC
  LOOP
    SELECT tp.* INTO v_participant
    FROM tournament_participants tp
    WHERE tp.tournament_id = p_tournament_id
    ORDER BY tp.points DESC,
             tp.wins DESC,
             tp.matches_played DESC,
             tp.joined_at ASC
    OFFSET (v_position.position - 1)
    LIMIT 1;

    IF NOT FOUND THEN
      EXIT;
    END IF;

    v_winner_user := COALESCE(v_participant.user_id, v_participant.payer_user_id);

    IF v_position.amount > 0 THEN
      UPDATE wallets
        SET balance = balance + v_position.amount,
            updated_at = now()
      WHERE user_id = v_winner_user;

      INSERT INTO transactions (user_id, type, amount, description, status)
      VALUES (
        v_winner_user,
        'payout',
        v_position.amount,
        format('Tournament prize: position %s', v_position.position),
        'completed'
      );

      INSERT INTO tournament_payouts (tournament_id, participant_id, position, amount)
      VALUES (p_tournament_id, v_participant.id, v_position.position, v_position.amount);

      v_paid_count := v_paid_count + 1;
    END IF;
  END LOOP;

  UPDATE matches
    SET status = CASE
          WHEN status IN ('finished', 'completed', 'admin_resolved', 'expired', 'cancelled', 'canceled') THEN status
          ELSE 'expired'
        END,
        finished_at = COALESCE(finished_at, now())
    WHERE tournament_id = p_tournament_id;

  UPDATE tournament_participants
    SET current_match_id = NULL,
        ready = false
    WHERE tournament_id = p_tournament_id;

  UPDATE tournaments
    SET status = 'completed',
        finalized_at = now(),
        updated_at = now()
    WHERE id = p_tournament_id;

  RETURN jsonb_build_object('success', true, 'positions_paid', v_paid_count);
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: tournament_tick (cron-callable / app heartbeat)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_tick()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t RECORD;
  v_started INTEGER := 0;
  v_finalized INTEGER := 0;
  v_auto_opened INTEGER := 0;
  v_reconciled INTEGER := 0;
  v_count INTEGER;
  v_ready INTEGER;
BEGIN
  -- Auto-open tournaments whose scheduled start time has arrived
  FOR v_t IN
    SELECT * FROM tournaments
    WHERE status = 'registering'
      AND scheduled_start_at IS NOT NULL
      AND scheduled_start_at <= now()
  LOOP
    SELECT COUNT(*) INTO v_count FROM tournament_participants WHERE tournament_id = v_t.id;
    IF v_count >= 2 THEN
      UPDATE tournaments
        SET status = 'ready_up',
            ready_up_deadline = now() + interval '90 seconds',
            updated_at = now()
        WHERE id = v_t.id;
      v_auto_opened := v_auto_opened + 1;
    ELSE
      PERFORM public.tournament_cancel_internal(v_t.id);
    END IF;
  END LOOP;

  -- Ready-up deadlines
  FOR v_t IN
    SELECT * FROM tournaments
    WHERE status = 'ready_up'
      AND ready_up_deadline IS NOT NULL
      AND ready_up_deadline < now()
  LOOP
    UPDATE tournament_participants
      SET eliminated = true
      WHERE tournament_id = v_t.id AND ready = false;

    SELECT COUNT(*) FILTER (WHERE NOT eliminated)
      INTO v_ready
      FROM tournament_participants
      WHERE tournament_id = v_t.id;

    IF v_ready < 2 THEN
      PERFORM public.tournament_cancel_internal(v_t.id);
    ELSE
      UPDATE tournaments
        SET status = 'running',
            started_at = now(),
            ends_at = now() + (v_t.duration_seconds || ' seconds')::interval,
            updated_at = now()
        WHERE id = v_t.id;
      PERFORM public.tournament_pair_idle(v_t.id);
      v_started := v_started + 1;
    END IF;
  END LOOP;

  -- Reconcile finished matches that were previously missed
  FOR v_t IN
    SELECT id
    FROM tournaments
    WHERE status = 'running'
  LOOP
    v_reconciled := v_reconciled + public.tournament_reconcile_finished_matches(v_t.id);
  END LOOP;

  -- Finalize timed-out running tournaments
  FOR v_t IN
    SELECT *
    FROM tournaments
    WHERE status = 'running'
      AND (
        (ends_at IS NOT NULL AND ends_at < now())
        OR (
          ends_at IS NULL
          AND started_at IS NOT NULL
          AND started_at + (duration_seconds || ' seconds')::interval < now()
        )
      )
  LOOP
    PERFORM public.tournament_finalize(v_t.id);
    v_finalized := v_finalized + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'auto_opened', v_auto_opened,
    'started', v_started,
    'reconciled', v_reconciled,
    'finalized', v_finalized
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tournament_apply_match_result(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.tournament_reconcile_finished_matches(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
