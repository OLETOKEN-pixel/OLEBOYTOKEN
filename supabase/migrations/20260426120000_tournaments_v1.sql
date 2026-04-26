-- =====================================================================
-- TOURNAMENTS v1
-- =====================================================================
-- Adds tournament functionality: creator-funded prize pool, registration,
-- ready-up phase, continuous auto-pairing during a fixed time window,
-- and points-based ranking with prize payout to top positions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 3 AND 60),
  creator_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('Box Fight', 'Realistic', 'Zone Wars')),
  team_size INTEGER NOT NULL CHECK (team_size BETWEEN 1 AND 4),
  first_to INTEGER NOT NULL DEFAULT 3 CHECK (first_to IN (1, 3, 5, 7, 10)),
  region TEXT NOT NULL DEFAULT 'EU' CHECK (region IN ('EU', 'NA-East', 'NA-West', 'OCE', 'BR', 'ASIA', 'ME')),
  platform TEXT NOT NULL DEFAULT 'All' CHECK (platform IN ('PC', 'Console', 'Mobile', 'All')),
  max_participants INTEGER NOT NULL CHECK (max_participants BETWEEN 2 AND 256),
  entry_fee NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (entry_fee >= 0),
  prize_pool_seed NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (prize_pool_seed >= 0),
  prize_pool_total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (prize_pool_total >= 0),
  duration_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (duration_seconds BETWEEN 300 AND 86400),
  rules TEXT,
  creator_is_admin BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'registering'
    CHECK (status IN ('registering', 'ready_up', 'running', 'completed', 'cancelled')),
  ready_up_deadline TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournaments_status_idx ON public.tournaments (status);
CREATE INDEX IF NOT EXISTS tournaments_creator_idx ON public.tournaments (creator_id);

CREATE TRIGGER tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready BOOLEAN NOT NULL DEFAULT false,
  ready_at TIMESTAMPTZ,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  current_match_id UUID,
  eliminated BOOLEAN NOT NULL DEFAULT false,
  CHECK ((user_id IS NOT NULL) <> (team_id IS NOT NULL)),
  UNIQUE (tournament_id, user_id),
  UNIQUE (tournament_id, team_id)
);

CREATE INDEX IF NOT EXISTS tp_tournament_idx ON public.tournament_participants (tournament_id);
CREATE INDEX IF NOT EXISTS tp_user_idx ON public.tournament_participants (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tp_team_idx ON public.tournament_participants (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tp_idle_idx ON public.tournament_participants (tournament_id)
  WHERE current_match_id IS NULL AND ready = true AND eliminated = false;

CREATE TABLE IF NOT EXISTS public.tournament_prize_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  UNIQUE (tournament_id, position)
);

CREATE INDEX IF NOT EXISTS tpp_tournament_idx ON public.tournament_prize_positions (tournament_id);

CREATE TABLE IF NOT EXISTS public.tournament_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.tournament_participants(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tpay_tournament_idx ON public.tournament_payouts (tournament_id);

-- Tag matches with their owning tournament (nullable; non-tournament matches unaffected)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS matches_tournament_idx ON public.matches (tournament_id) WHERE tournament_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- RLS POLICIES
-- ---------------------------------------------------------------------

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_prize_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournaments viewable by all"
  ON public.tournaments FOR SELECT USING (true);

CREATE POLICY "Tournaments writable by creator or admin"
  ON public.tournaments FOR UPDATE USING (
    creator_id = auth.uid() OR public.is_admin()
  );

CREATE POLICY "Tournament participants viewable by all"
  ON public.tournament_participants FOR SELECT USING (true);

CREATE POLICY "Tournament prize positions viewable by all"
  ON public.tournament_prize_positions FOR SELECT USING (true);

CREATE POLICY "Tournament payouts viewable by all"
  ON public.tournament_payouts FOR SELECT USING (true);

-- ---------------------------------------------------------------------
-- HELPER: validate prize positions sum
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._tournament_validate_prize_positions(
  p_tournament_id UUID,
  p_expected_total NUMERIC
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_sum NUMERIC;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO v_sum
  FROM public.tournament_prize_positions
  WHERE tournament_id = p_tournament_id;
  RETURN ROUND(v_sum, 2) = ROUND(p_expected_total, 2);
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: create_tournament
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_tournament(
  p_name TEXT,
  p_mode TEXT,
  p_team_size INTEGER,
  p_max_participants INTEGER,
  p_entry_fee NUMERIC,
  p_prize_pool NUMERIC,
  p_duration_seconds INTEGER,
  p_first_to INTEGER DEFAULT 3,
  p_region TEXT DEFAULT 'EU',
  p_platform TEXT DEFAULT 'All',
  p_rules TEXT DEFAULT NULL,
  p_prize_positions JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_tournament_id UUID;
  v_balance NUMERIC;
  v_position JSONB;
  v_sum NUMERIC := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT public.is_admin() INTO v_is_admin;
  v_is_admin := COALESCE(v_is_admin, false);

  IF p_max_participants < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament needs at least 2 participants');
  END IF;

  IF jsonb_array_length(p_prize_positions) < 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least one prize position required');
  END IF;

  -- Validate position payouts sum
  FOR v_position IN SELECT * FROM jsonb_array_elements(p_prize_positions) LOOP
    v_sum := v_sum + COALESCE((v_position->>'amount')::numeric, 0);
  END LOOP;

  IF ROUND(v_sum, 2) <> ROUND(p_prize_pool, 2) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Prize positions sum (%s) must equal prize pool (%s)', v_sum, p_prize_pool)
    );
  END IF;

  -- Non-admin creators must have funds for the seed prize pool
  IF NOT v_is_admin AND p_prize_pool > 0 THEN
    SELECT balance INTO v_balance FROM wallets WHERE user_id = v_user_id;
    IF v_balance IS NULL OR v_balance < p_prize_pool THEN
      RETURN jsonb_build_object('success', false, 'error', 'Saldo insufficiente per il prize pool');
    END IF;

    UPDATE wallets
      SET balance = balance - p_prize_pool,
          updated_at = now()
      WHERE user_id = v_user_id;

    INSERT INTO transactions (user_id, type, amount, description, status)
    VALUES (v_user_id, 'lock', p_prize_pool, 'Tournament prize pool seed', 'completed');
  END IF;

  INSERT INTO tournaments (
    name, creator_id, mode, team_size, first_to, region, platform,
    max_participants, entry_fee, prize_pool_seed, prize_pool_total,
    duration_seconds, rules, creator_is_admin, status
  ) VALUES (
    p_name, v_user_id, p_mode, p_team_size, p_first_to, p_region, p_platform,
    p_max_participants, p_entry_fee, p_prize_pool, p_prize_pool,
    p_duration_seconds, p_rules, v_is_admin, 'registering'
  )
  RETURNING id INTO v_tournament_id;

  -- Insert prize positions
  FOR v_position IN SELECT * FROM jsonb_array_elements(p_prize_positions) LOOP
    INSERT INTO tournament_prize_positions (tournament_id, position, amount)
    VALUES (
      v_tournament_id,
      (v_position->>'position')::integer,
      (v_position->>'amount')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'tournament_id', v_tournament_id);
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: tournament_register
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tournament_register(
  p_tournament_id UUID,
  p_team_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tournament tournaments%ROWTYPE;
  v_balance NUMERIC;
  v_count INTEGER;
  v_team_owner UUID;
  v_member_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.status <> 'registering' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration is closed');
  END IF;

  -- Capacity check
  SELECT COUNT(*) INTO v_count
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id;

  IF v_count >= v_tournament.max_participants THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament is full');
  END IF;

  -- Solo vs team registration
  IF v_tournament.team_size = 1 THEN
    IF p_team_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Solo tournament does not accept teams');
    END IF;

    -- Already registered?
    IF EXISTS (SELECT 1 FROM tournament_participants
               WHERE tournament_id = p_tournament_id AND user_id = v_user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already registered');
    END IF;
  ELSE
    IF p_team_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Team required for this tournament size');
    END IF;

    -- Caller must be the team owner
    SELECT owner_id INTO v_team_owner FROM teams WHERE id = p_team_id;
    IF v_team_owner IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Team not found');
    END IF;
    IF v_team_owner <> v_user_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the team owner can register');
    END IF;

    -- Team must have enough accepted members
    SELECT COUNT(*) INTO v_member_count
    FROM team_members
    WHERE team_id = p_team_id AND status = 'accepted';

    IF v_member_count < v_tournament.team_size THEN
      RETURN jsonb_build_object('success', false, 'error',
        format('Team needs %s accepted members (has %s)', v_tournament.team_size, v_member_count));
    END IF;

    IF EXISTS (SELECT 1 FROM tournament_participants
               WHERE tournament_id = p_tournament_id AND team_id = p_team_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Team already registered');
    END IF;
  END IF;

  -- Debit entry fee from caller (cover semantics for v1)
  IF v_tournament.entry_fee > 0 THEN
    SELECT balance INTO v_balance FROM wallets WHERE user_id = v_user_id;
    IF v_balance IS NULL OR v_balance < v_tournament.entry_fee THEN
      RETURN jsonb_build_object('success', false, 'error', 'Saldo insufficiente per la entry fee');
    END IF;

    UPDATE wallets
      SET balance = balance - v_tournament.entry_fee,
          updated_at = now()
      WHERE user_id = v_user_id;

    INSERT INTO transactions (user_id, type, amount, description, status)
    VALUES (v_user_id, 'lock', v_tournament.entry_fee, 'Tournament entry fee', 'completed');

    UPDATE tournaments
      SET prize_pool_total = prize_pool_total + v_tournament.entry_fee,
          updated_at = now()
      WHERE id = p_tournament_id;
  END IF;

  INSERT INTO tournament_participants (
    tournament_id, user_id, team_id, payer_user_id, paid_amount
  ) VALUES (
    p_tournament_id,
    CASE WHEN v_tournament.team_size = 1 THEN v_user_id ELSE NULL END,
    CASE WHEN v_tournament.team_size > 1 THEN p_team_id ELSE NULL END,
    v_user_id,
    v_tournament.entry_fee
  );

  -- Auto-transition to ready_up when full
  v_count := v_count + 1;
  IF v_count = v_tournament.max_participants THEN
    UPDATE tournaments
      SET status = 'ready_up',
          ready_up_deadline = now() + interval '90 seconds',
          updated_at = now()
      WHERE id = p_tournament_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: tournament_start (manual start by creator/admin)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tournament_start(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tournament tournaments%ROWTYPE;
  v_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.creator_id <> v_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  IF v_tournament.status <> 'registering' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament cannot be started from current state');
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id;

  IF v_count < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'At least 2 participants required to start');
  END IF;

  UPDATE tournaments
    SET status = 'ready_up',
        ready_up_deadline = now() + interval '90 seconds',
        updated_at = now()
    WHERE id = p_tournament_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: tournament_set_ready
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tournament_set_ready(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tournament tournaments%ROWTYPE;
  v_participant_id UUID;
  v_total INTEGER;
  v_ready INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.status NOT IN ('ready_up', 'running') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not ready to accept ready-up');
  END IF;

  -- Find participant: solo by user, team by ownership
  SELECT id INTO v_participant_id
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id
    AND (user_id = v_user_id
         OR team_id IN (SELECT id FROM teams WHERE owner_id = v_user_id));

  IF v_participant_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a participant');
  END IF;

  UPDATE tournament_participants
    SET ready = true, ready_at = now()
    WHERE id = v_participant_id AND ready = false;

  -- If everyone ready and tournament not yet running, transition to running
  IF v_tournament.status = 'ready_up' THEN
    SELECT COUNT(*), COUNT(*) FILTER (WHERE ready = true)
      INTO v_total, v_ready
      FROM tournament_participants
      WHERE tournament_id = p_tournament_id;

    IF v_ready = v_total THEN
      UPDATE tournaments
        SET status = 'running',
            started_at = now(),
            ends_at = now() + (v_tournament.duration_seconds || ' seconds')::interval,
            updated_at = now()
        WHERE id = p_tournament_id;
    END IF;
  END IF;

  -- Try to pair available participants
  PERFORM public.tournament_pair_idle(p_tournament_id);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: tournament_pair_idle (internal — creates matches for idle pairs)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tournament_pair_idle(p_tournament_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament tournaments%ROWTYPE;
  v_a tournament_participants%ROWTYPE;
  v_b tournament_participants%ROWTYPE;
  v_match_id UUID;
  v_paired INTEGER := 0;
  v_team_a_members UUID[];
  v_team_b_members UUID[];
  v_member UUID;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id;
  IF NOT FOUND OR v_tournament.status <> 'running' THEN
    RETURN 0;
  END IF;

  IF v_tournament.ends_at IS NOT NULL AND v_tournament.ends_at < now() THEN
    RETURN 0;
  END IF;

  LOOP
    -- Pick two idle participants
    SELECT * INTO v_a FROM tournament_participants
      WHERE tournament_id = p_tournament_id
        AND current_match_id IS NULL
        AND ready = true
        AND eliminated = false
      ORDER BY matches_played ASC, random()
      LIMIT 1;

    IF NOT FOUND THEN EXIT; END IF;

    SELECT * INTO v_b FROM tournament_participants
      WHERE tournament_id = p_tournament_id
        AND current_match_id IS NULL
        AND ready = true
        AND eliminated = false
        AND id <> v_a.id
      ORDER BY matches_played ASC, random()
      LIMIT 1;

    IF NOT FOUND THEN EXIT; END IF;

    -- Create match (entry_fee 0 — already paid via tournament registration)
    INSERT INTO matches (
      creator_id, game, region, platform, mode, team_size, first_to,
      entry_fee, is_private, status, expires_at,
      payment_mode_host, host_payer_user_id,
      captain_a_user_id, captain_b_user_id,
      team_a_id, team_b_id,
      tournament_id
    ) VALUES (
      v_tournament.creator_id, 'FN', v_tournament.region, v_tournament.platform,
      v_tournament.mode, v_tournament.team_size, v_tournament.first_to,
      0, true, 'ready_check', now() + interval '60 minutes',
      'cover', v_tournament.creator_id,
      CASE WHEN v_tournament.team_size = 1 THEN v_a.user_id ELSE NULL END,
      CASE WHEN v_tournament.team_size = 1 THEN v_b.user_id ELSE NULL END,
      CASE WHEN v_tournament.team_size > 1 THEN v_a.team_id ELSE NULL END,
      CASE WHEN v_tournament.team_size > 1 THEN v_b.team_id ELSE NULL END,
      p_tournament_id
    )
    RETURNING id INTO v_match_id;

    -- Insert match participants
    IF v_tournament.team_size = 1 THEN
      INSERT INTO match_participants (match_id, user_id, team_side, status)
      VALUES (v_match_id, v_a.user_id, 'A', 'joined'),
             (v_match_id, v_b.user_id, 'B', 'joined');
    ELSE
      -- Add accepted team members on each side
      SELECT ARRAY_AGG(user_id) INTO v_team_a_members
        FROM team_members
        WHERE team_id = v_a.team_id AND status = 'accepted'
        LIMIT v_tournament.team_size;

      SELECT ARRAY_AGG(user_id) INTO v_team_b_members
        FROM team_members
        WHERE team_id = v_b.team_id AND status = 'accepted'
        LIMIT v_tournament.team_size;

      FOREACH v_member IN ARRAY v_team_a_members LOOP
        INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
        VALUES (v_match_id, v_member, v_a.team_id, 'A', 'joined');
      END LOOP;
      FOREACH v_member IN ARRAY v_team_b_members LOOP
        INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
        VALUES (v_match_id, v_member, v_b.team_id, 'B', 'joined');
      END LOOP;
    END IF;

    -- Mark both tournament participants as in-match
    UPDATE tournament_participants
      SET current_match_id = v_match_id
      WHERE id IN (v_a.id, v_b.id);

    v_paired := v_paired + 1;

    -- Hard cap to avoid runaway loops
    IF v_paired >= 50 THEN EXIT; END IF;
  END LOOP;

  RETURN v_paired;
END;
$$;

-- ---------------------------------------------------------------------
-- TRIGGER: tournament_match_completed
-- When a tournament-tagged match transitions to 'completed' or 'finished',
-- award points, free participants, and try to pair more.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tournament_on_match_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner_user UUID;
  v_winner_team UUID;
  v_winner_pid UUID;
  v_loser_pid UUID;
BEGIN
  IF NEW.tournament_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('completed', 'finished') THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('completed', 'finished') THEN
    RETURN NEW;
  END IF;

  SELECT winner_user_id, winner_team_id INTO v_winner_user, v_winner_team
  FROM match_results WHERE match_id = NEW.id;

  -- Resolve participants
  IF v_winner_team IS NOT NULL THEN
    SELECT id INTO v_winner_pid FROM tournament_participants
      WHERE tournament_id = NEW.tournament_id AND team_id = v_winner_team;
    SELECT id INTO v_loser_pid FROM tournament_participants
      WHERE tournament_id = NEW.tournament_id AND current_match_id = NEW.id AND id <> v_winner_pid;
  ELSIF v_winner_user IS NOT NULL THEN
    SELECT id INTO v_winner_pid FROM tournament_participants
      WHERE tournament_id = NEW.tournament_id AND user_id = v_winner_user;
    SELECT id INTO v_loser_pid FROM tournament_participants
      WHERE tournament_id = NEW.tournament_id AND current_match_id = NEW.id AND id <> v_winner_pid;
  END IF;

  -- Award stats
  IF v_winner_pid IS NOT NULL THEN
    UPDATE tournament_participants
      SET points = points + 3,
          wins = wins + 1,
          matches_played = matches_played + 1,
          current_match_id = NULL
      WHERE id = v_winner_pid;
  END IF;

  IF v_loser_pid IS NOT NULL THEN
    UPDATE tournament_participants
      SET losses = losses + 1,
          matches_played = matches_played + 1,
          current_match_id = NULL
      WHERE id = v_loser_pid;
  END IF;

  -- Free any participants tagged to this match (defensive — covers no-result-recorded edge case)
  UPDATE tournament_participants
    SET current_match_id = NULL
    WHERE current_match_id = NEW.id;

  -- Try to pair more matches
  PERFORM public.tournament_pair_idle(NEW.tournament_id);

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
-- RPC: tournament_finalize (called when ends_at passes)
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

  -- Pay out positions
  FOR v_position IN
    SELECT position, amount FROM tournament_prize_positions
    WHERE tournament_id = p_tournament_id
    ORDER BY position ASC
  LOOP
    -- Pick the participant ranked at this position
    SELECT tp.* INTO v_participant
    FROM tournament_participants tp
    WHERE tp.tournament_id = p_tournament_id
    ORDER BY tp.points DESC,
             tp.wins DESC,
             tp.matches_played DESC,
             tp.joined_at ASC
    OFFSET (v_position.position - 1)
    LIMIT 1;

    IF NOT FOUND THEN EXIT; END IF;

    -- Determine recipient (solo: user, team: payer/owner)
    v_winner_user := COALESCE(v_participant.user_id, v_participant.payer_user_id);

    IF v_position.amount > 0 THEN
      UPDATE wallets
        SET balance = balance + v_position.amount,
            updated_at = now()
        WHERE user_id = v_winner_user;

      INSERT INTO transactions (user_id, type, amount, description, status)
      VALUES (v_winner_user, 'payout', v_position.amount,
              format('Tournament prize: position %s', v_position.position), 'completed');

      INSERT INTO tournament_payouts (tournament_id, participant_id, position, amount)
      VALUES (p_tournament_id, v_participant.id, v_position.position, v_position.amount);

      v_paid_count := v_paid_count + 1;
    END IF;
  END LOOP;

  UPDATE tournaments
    SET status = 'completed',
        finalized_at = now(),
        updated_at = now()
    WHERE id = p_tournament_id;

  RETURN jsonb_build_object('success', true, 'positions_paid', v_paid_count);
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: tournament_cancel (refunds entry fees and creator seed)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.tournament_cancel(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tournament tournaments%ROWTYPE;
  v_participant RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tournament.creator_id <> v_user_id AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Forbidden');
  END IF;

  IF v_tournament.status NOT IN ('registering', 'ready_up') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel after start');
  END IF;

  -- Refund entry fees
  FOR v_participant IN
    SELECT * FROM tournament_participants WHERE tournament_id = p_tournament_id
  LOOP
    IF v_participant.paid_amount > 0 THEN
      UPDATE wallets
        SET balance = balance + v_participant.paid_amount,
            updated_at = now()
        WHERE user_id = v_participant.payer_user_id;

      INSERT INTO transactions (user_id, type, amount, description, status)
      VALUES (v_participant.payer_user_id, 'refund', v_participant.paid_amount,
              'Tournament cancelled — entry fee refund', 'completed');
    END IF;
  END LOOP;

  -- Refund creator's seed if they actually paid (non-admin)
  IF NOT v_tournament.creator_is_admin AND v_tournament.prize_pool_seed > 0 THEN
    UPDATE wallets
      SET balance = balance + v_tournament.prize_pool_seed,
          updated_at = now()
      WHERE user_id = v_tournament.creator_id;

    INSERT INTO transactions (user_id, type, amount, description, status)
    VALUES (v_tournament.creator_id, 'refund', v_tournament.prize_pool_seed,
            'Tournament cancelled — prize pool seed refund', 'completed');
  END IF;

  UPDATE tournaments
    SET status = 'cancelled',
        finalized_at = now(),
        updated_at = now()
    WHERE id = p_tournament_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ---------------------------------------------------------------------
-- RPC: tournament_tick (cron-callable; processes ready-up timeouts and finalization)
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
  v_total INTEGER;
  v_ready INTEGER;
BEGIN
  -- Ready-up deadline expired: kick non-ready participants and start (or cancel)
  FOR v_t IN
    SELECT * FROM tournaments
    WHERE status = 'ready_up' AND ready_up_deadline IS NOT NULL AND ready_up_deadline < now()
  LOOP
    -- Eliminate non-ready participants
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

  -- Time elapsed: finalize
  FOR v_t IN
    SELECT * FROM tournaments
    WHERE status = 'running' AND ends_at IS NOT NULL AND ends_at < now()
  LOOP
    PERFORM public.tournament_finalize(v_t.id);
    v_finalized := v_finalized + 1;
  END LOOP;

  RETURN jsonb_build_object('started', v_started, 'finalized', v_finalized);
END;
$$;

-- Internal cancel (no auth check) used by tournament_tick
CREATE OR REPLACE FUNCTION public.tournament_cancel_internal(p_tournament_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament tournaments%ROWTYPE;
  v_participant RECORD;
BEGIN
  SELECT * INTO v_tournament FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND OR v_tournament.status NOT IN ('registering', 'ready_up') THEN
    RETURN;
  END IF;

  FOR v_participant IN
    SELECT * FROM tournament_participants WHERE tournament_id = p_tournament_id
  LOOP
    IF v_participant.paid_amount > 0 THEN
      UPDATE wallets
        SET balance = balance + v_participant.paid_amount,
            updated_at = now()
        WHERE user_id = v_participant.payer_user_id;

      INSERT INTO transactions (user_id, type, amount, description, status)
      VALUES (v_participant.payer_user_id, 'refund', v_participant.paid_amount,
              'Tournament cancelled — entry fee refund', 'completed');
    END IF;
  END LOOP;

  IF NOT v_tournament.creator_is_admin AND v_tournament.prize_pool_seed > 0 THEN
    UPDATE wallets
      SET balance = balance + v_tournament.prize_pool_seed,
          updated_at = now()
      WHERE user_id = v_tournament.creator_id;

    INSERT INTO transactions (user_id, type, amount, description, status)
    VALUES (v_tournament.creator_id, 'refund', v_tournament.prize_pool_seed,
            'Tournament cancelled — prize pool seed refund', 'completed');
  END IF;

  UPDATE tournaments
    SET status = 'cancelled',
        finalized_at = now(),
        updated_at = now()
    WHERE id = p_tournament_id;
END;
$$;

-- ---------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.create_tournament TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_register TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_start TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_set_ready TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_cancel TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_finalize TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournament_tick TO authenticated, anon, service_role;

-- ---------------------------------------------------------------------
-- REALTIME
-- ---------------------------------------------------------------------

ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_participants;
