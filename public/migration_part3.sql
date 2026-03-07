-- Reinstall extensions into a non-public schema (pg_net doesn't support SET SCHEMA)
CREATE SCHEMA IF NOT EXISTS extensions;

-- No scheduled jobs exist yet, safe to reinstall
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;

DROP EXTENSION IF EXISTS pg_cron;
CREATE EXTENSION pg_cron WITH SCHEMA extensions;
-- Definitive minimal fix: automatic match expiration + ghost cleanup
-- Fixes ONLY: auto-expire + scheduler; no changes to create/join/ready/result/payout flows.

-- 1) Ensure scheduler extension exists
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) Patch: READY_CHECK timeout + stronger idempotency guards (no schema changes)
CREATE OR REPLACE FUNCTION public.expire_stale_matches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_participant RECORD;
  v_captain_id uuid;
  v_refund_amount numeric;
  v_expired_count integer := 0;
  v_refunded_total numeric := 0;
BEGIN
  FOR v_match IN
    SELECT m.*
    FROM matches m
    WHERE m.status IN ('open', 'ready_check', 'joined', 'full')
      AND (
        (
          m.status IN ('open','joined','full')
          AND (
            (m.expires_at IS NOT NULL AND m.expires_at < now())
            OR (m.expires_at IS NULL AND m.created_at < now() - interval '30 minutes')
          )
        )
        OR (
          m.status = 'ready_check'
          AND m.started_at IS NULL
          AND (
            (m.ready_check_at IS NOT NULL AND m.ready_check_at < now() - interval '30 minutes')
            OR (m.ready_check_at IS NULL AND m.expires_at IS NOT NULL AND m.expires_at < now())
            OR (m.ready_check_at IS NULL AND m.expires_at IS NULL AND m.created_at < now() - interval '30 minutes')
          )
        )
      )
  LOOP
    IF v_match.team_size = 1 THEN
      FOR v_participant IN
        SELECT mp.user_id, mp.team_side
        FROM match_participants mp
        WHERE mp.match_id = v_match.id
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM transactions t
          WHERE t.match_id = v_match.id
            AND t.user_id = v_participant.user_id
            AND t.type = 'refund'
        ) THEN
          UPDATE wallets
          SET balance = balance + v_match.entry_fee,
              locked_balance = locked_balance - v_match.entry_fee
          WHERE user_id = v_participant.user_id
            AND locked_balance >= v_match.entry_fee;

          IF FOUND THEN
            INSERT INTO transactions (user_id, type, amount, match_id, description)
            VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 'Match expired - automatic refund');
            v_refunded_total := v_refunded_total + v_match.entry_fee;
          END IF;
        END IF;
      END LOOP;

    ELSE
      -- Team A
      IF v_match.payment_mode_host = 'cover' THEN
        v_captain_id := v_match.captain_a_user_id;
        IF v_captain_id IS NULL THEN
          SELECT mp.user_id INTO v_captain_id
          FROM match_participants mp
          WHERE mp.match_id = v_match.id AND mp.team_side = 'A'
          ORDER BY mp.joined_at ASC LIMIT 1;
        END IF;

        IF v_captain_id IS NOT NULL THEN
          v_refund_amount := v_match.entry_fee * v_match.team_size;
          IF NOT EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.match_id = v_match.id AND t.user_id = v_captain_id AND t.type = 'refund'
          ) THEN
            UPDATE wallets
            SET balance = balance + v_refund_amount,
                locked_balance = locked_balance - v_refund_amount
            WHERE user_id = v_captain_id
              AND locked_balance >= v_refund_amount;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 'Match expired - captain refund (cover mode)');
              v_refunded_total := v_refunded_total + v_refund_amount;
            END IF;
          END IF;
        END IF;
      ELSE
        FOR v_participant IN
          SELECT mp.user_id
          FROM match_participants mp
          WHERE mp.match_id = v_match.id AND mp.team_side = 'A'
        LOOP
          IF NOT EXISTS (
            SELECT 1 FROM transactions t
            WHERE t.match_id = v_match.id AND t.user_id = v_participant.user_id AND t.type = 'refund'
          ) THEN
            UPDATE wallets
            SET balance = balance + v_match.entry_fee,
                locked_balance = locked_balance - v_match.entry_fee
            WHERE user_id = v_participant.user_id
              AND locked_balance >= v_match.entry_fee;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 'Match expired - automatic refund (split mode)');
              v_refunded_total := v_refunded_total + v_match.entry_fee;
            END IF;
          END IF;
        END LOOP;
      END IF;

      -- Team B (only if joined)
      IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = v_match.id AND team_side = 'B') THEN
        IF v_match.payment_mode_joiner = 'cover' THEN
          v_captain_id := v_match.captain_b_user_id;
          IF v_captain_id IS NULL THEN
            SELECT mp.user_id INTO v_captain_id
            FROM match_participants mp
            WHERE mp.match_id = v_match.id AND mp.team_side = 'B'
            ORDER BY mp.joined_at ASC LIMIT 1;
          END IF;

          IF v_captain_id IS NOT NULL THEN
            v_refund_amount := v_match.entry_fee * v_match.team_size;
            IF NOT EXISTS (
              SELECT 1 FROM transactions t
              WHERE t.match_id = v_match.id AND t.user_id = v_captain_id AND t.type = 'refund'
            ) THEN
              UPDATE wallets
              SET balance = balance + v_refund_amount,
                  locked_balance = locked_balance - v_refund_amount
              WHERE user_id = v_captain_id
                AND locked_balance >= v_refund_amount;

              IF FOUND THEN
                INSERT INTO transactions (user_id, type, amount, match_id, description)
                VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 'Match expired - captain refund (cover mode)');
                v_refunded_total := v_refunded_total + v_refund_amount;
              END IF;
            END IF;
          END IF;
        ELSE
          FOR v_participant IN
            SELECT mp.user_id
            FROM match_participants mp
            WHERE mp.match_id = v_match.id AND mp.team_side = 'B'
          LOOP
            IF NOT EXISTS (
              SELECT 1 FROM transactions t
              WHERE t.match_id = v_match.id AND t.user_id = v_participant.user_id AND t.type = 'refund'
            ) THEN
              UPDATE wallets
              SET balance = balance + v_match.entry_fee,
                  locked_balance = locked_balance - v_match.entry_fee
              WHERE user_id = v_participant.user_id
                AND locked_balance >= v_match.entry_fee;

              IF FOUND THEN
                INSERT INTO transactions (user_id, type, amount, match_id, description)
                VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 'Match expired - automatic refund (split mode)');
                v_refunded_total := v_refunded_total + v_match.entry_fee;
              END IF;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;

    UPDATE matches
    SET status = 'expired'
    WHERE id = v_match.id
      AND status IN ('open', 'ready_check', 'joined', 'full');

    IF FOUND THEN
      v_expired_count := v_expired_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'refunded_total', v_refunded_total,
    'processed_at', now()
  );
END;
$$;

-- 3) Idempotent cron job (every minute)
DO $cronblock$
DECLARE
  v_job_id bigint;
BEGIN
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'expire-stale-matches-every-minute'
  LIMIT 1;

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'expire-stale-matches-every-minute',
    '* * * * *',
    $cmd$select public.expire_stale_matches();$cmd$
  );
END
$cronblock$;

-- 4) Immediate backfill pass
SELECT public.expire_stale_matches();
-- Fix definitivo: rimuove ogni uso di transactions.reference_id (colonna inesistente) dai RPC team.

CREATE OR REPLACE FUNCTION public.join_team_match(
  p_match_id uuid,
  p_team_id uuid,
  p_payment_mode text DEFAULT 'cover'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_team teams%ROWTYPE;
  v_total_lock numeric;
  v_member_share numeric;
  v_member record;
  v_active_count integer;
  v_ghost record;
  v_block record;
BEGIN
  -- 1. Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;
  IF v_match.team_b_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match already has an opponent');
  END IF;

  -- 2. Verify caller owns the joining team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  IF v_team.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can join matches');
  END IF;

  -- 3. Cannot join own match
  IF v_match.team_a_id = p_team_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot join your own match');
  END IF;

  -- 4. Check team has enough accepted members
  IF (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id AND status = 'accepted') < v_match.team_size THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team does not have enough accepted members');
  END IF;

  -- 5. Check no active match for any team member (STRICT)
  -- Active match statuses: open | ready_check | in_progress | result_pending
  -- Active participant statuses: joined | ready | playing
  FOR v_member IN
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT v_match.team_size
  LOOP
    -- 5a) Auto-clean ghost matches that are objectively terminal by timestamps (safe cleanup)
    FOR v_ghost IN
      SELECT m.id AS match_id
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND (m.expires_at <= now() OR m.finished_at IS NOT NULL)
    LOOP
      UPDATE matches
      SET status = CASE WHEN finished_at IS NOT NULL THEN 'finished' ELSE 'expired' END
      WHERE id = v_ghost.match_id
        AND status IN ('open','ready_check','in_progress','result_pending')
        AND (expires_at <= now() OR finished_at IS NOT NULL);

      UPDATE match_participants
      SET status = 'left'
      WHERE match_id = v_ghost.match_id
        AND status IN ('joined','ready','playing');

      RAISE LOG '[join_team_match ghost-clean] member=% match_id=%', v_member.user_id, v_ghost.match_id;
    END LOOP;

    -- 5b) Strict active-match check (only real active participations block)
    SELECT COUNT(*) INTO v_active_count
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = v_member.user_id
      AND mp.status IN ('joined','ready','playing')
      AND m.status IN ('open','ready_check','in_progress','result_pending')
      AND m.expires_at > now()
      AND m.finished_at IS NULL;

    IF v_active_count > 0 THEN
      -- Logging (temporary) to identify the exact blocking match
      SELECT m.id AS match_id,
             m.status AS match_status,
             mp.status AS participant_status,
             m.expires_at,
             m.finished_at,
             m.created_at
      INTO v_block
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND m.expires_at > now()
        AND m.finished_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1;

      RAISE LOG '[join_team_match busy-check] member=% match_id=% match_status=% participant_status=% expires_at=% finished_at=% created_at=%',
        v_member.user_id,
        v_block.match_id,
        v_block.match_status,
        v_block.participant_status,
        v_block.expires_at,
        v_block.finished_at,
        v_block.created_at;

      RETURN jsonb_build_object('success', false, 'error', 'One or more team members already have an active match');
    END IF;
  END LOOP;

  -- 6. Handle payment based on mode
  IF p_payment_mode = 'cover' THEN
    -- Owner covers entire team: entry_fee * team_size
    v_total_lock := v_match.entry_fee * v_match.team_size;

    UPDATE wallets
    SET balance = balance - v_total_lock,
        locked_balance = locked_balance + v_total_lock,
        updated_at = now()
    WHERE user_id = v_caller_id AND balance >= v_total_lock;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance to cover team entry');
    END IF;

    -- FIX: use match_id (real column) instead of reference_id
    INSERT INTO transactions (user_id, type, amount, description, match_id)
    VALUES (v_caller_id, 'lock', v_total_lock, 'Match entry locked (covering team)', p_match_id);

  ELSIF p_payment_mode = 'split' THEN
    v_member_share := v_match.entry_fee;

    FOR v_member IN
      SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT v_match.team_size
    LOOP
      UPDATE wallets
      SET balance = balance - v_member_share,
          locked_balance = locked_balance + v_member_share,
          updated_at = now()
      WHERE user_id = v_member.user_id AND balance >= v_member_share;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Member % has insufficient balance', v_member.user_id;
      END IF;

      -- FIX: use match_id (real column) instead of reference_id
      INSERT INTO transactions (user_id, type, amount, description, match_id)
      VALUES (v_member.user_id, 'lock', v_member_share, 'Match entry locked (split)', p_match_id);
    END LOOP;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment mode');
  END IF;

  -- 7. Update match with team B info
  UPDATE matches SET
    team_b_id = p_team_id,
    captain_b_user_id = v_caller_id,
    joiner_payment_mode = p_payment_mode,
    joiner_payer_user_id = v_caller_id,
    status = 'ready_check',
    ready_check_at = now()
  WHERE id = p_match_id;

  -- 8. Add team B members as participants
  INSERT INTO match_participants (match_id, user_id, team_side, joined_at, payment_mode)
  SELECT p_match_id, tm.user_id, 'B', now(), p_payment_mode
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
  LIMIT v_match.team_size;

  RETURN jsonb_build_object('success', true, 'match_id', p_match_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;


-- Overload legacy: create_team_match(p_game, ...) - fix reference_id -> match_id without changing the rest.
CREATE OR REPLACE FUNCTION public.create_team_match(
  p_team_id uuid,
  p_game text,
  p_region text,
  p_platform text,
  p_mode text,
  p_team_size integer,
  p_first_to integer,
  p_entry_fee numeric,
  p_is_private boolean DEFAULT false,
  p_payment_mode text DEFAULT 'cover'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_team teams%ROWTYPE;
  v_match_id uuid;
  v_expires_at timestamptz;
  v_active_count integer;
  v_total_lock numeric;
  v_member record;
  v_member_share numeric;
  v_ghost record;
  v_block record;
  v_tx_time timestamptz := now();
BEGIN
  -- 1. Verify caller owns the team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  IF v_team.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can create matches');
  END IF;

  -- 2. Check team has enough accepted members
  IF (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id AND status = 'accepted') < p_team_size THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team does not have enough accepted members');
  END IF;

  -- 3. Check no active match for any team member (STRICT)
  FOR v_member IN
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT p_team_size
  LOOP
    -- Auto-clean ghost matches (safe)
    FOR v_ghost IN
      SELECT m.id AS match_id
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND (m.expires_at <= now() OR m.finished_at IS NOT NULL)
    LOOP
      UPDATE matches
      SET status = CASE WHEN finished_at IS NOT NULL THEN 'finished' ELSE 'expired' END
      WHERE id = v_ghost.match_id
        AND status IN ('open','ready_check','in_progress','result_pending')
        AND (expires_at <= now() OR finished_at IS NOT NULL);

      UPDATE match_participants
      SET status = 'left'
      WHERE match_id = v_ghost.match_id
        AND status IN ('joined','ready','playing');

      RAISE LOG '[create_team_match(p_game) ghost-clean] member=% match_id=%', v_member.user_id, v_ghost.match_id;
    END LOOP;

    SELECT COUNT(*) INTO v_active_count
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = v_member.user_id
      AND mp.status IN ('joined','ready','playing')
      AND m.status IN ('open','ready_check','in_progress','result_pending')
      AND m.expires_at > now()
      AND m.finished_at IS NULL;

    IF v_active_count > 0 THEN
      SELECT m.id AS match_id,
             m.status AS match_status,
             mp.status AS participant_status,
             m.expires_at,
             m.finished_at,
             m.created_at
      INTO v_block
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND m.expires_at > now()
        AND m.finished_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1;

      RAISE LOG '[create_team_match(p_game) busy-check] member=% match_id=% match_status=% participant_status=% expires_at=% finished_at=% created_at=%',
        v_member.user_id,
        v_block.match_id,
        v_block.match_status,
        v_block.participant_status,
        v_block.expires_at,
        v_block.finished_at,
        v_block.created_at;

      RETURN jsonb_build_object('success', false, 'error', 'One or more team members already have an active match');
    END IF;
  END LOOP;

  -- 4. Handle payment based on mode
  IF p_payment_mode = 'cover' THEN
    -- Owner covers the entire team: entry_fee * team_size
    v_total_lock := p_entry_fee * p_team_size;

    -- Check and lock funds from owner
    UPDATE wallets
    SET balance = balance - v_total_lock,
        locked_balance = locked_balance + v_total_lock,
        updated_at = now()
    WHERE user_id = v_caller_id AND balance >= v_total_lock;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance to cover team entry');
    END IF;

    -- FIX: write into match_id (nullable) instead of reference_id
    INSERT INTO transactions (user_id, type, amount, description, match_id, created_at)
    VALUES (v_caller_id, 'lock', v_total_lock, 'Match entry locked (covering team)', NULL, v_tx_time);

  ELSIF p_payment_mode = 'split' THEN
    -- Each member pays their share
    v_member_share := p_entry_fee;

    FOR v_member IN
      SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT p_team_size
    LOOP
      UPDATE wallets
      SET balance = balance - v_member_share,
          locked_balance = locked_balance + v_member_share,
          updated_at = now()
      WHERE user_id = v_member.user_id AND balance >= v_member_share;

      IF NOT FOUND THEN
        -- Rollback: This will be handled by transaction rollback
        RAISE EXCEPTION 'Member % has insufficient balance', v_member.user_id;
      END IF;

      -- FIX: keep lock transaction but set match_id NULL now; it will be backfilled to v_match_id after match creation
      INSERT INTO transactions (user_id, type, amount, description, match_id, created_at)
      VALUES (v_member.user_id, 'lock', v_member_share, 'Match entry locked (split)', NULL, v_tx_time);
    END LOOP;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment mode');
  END IF;

  -- 5. Create match
  v_expires_at := now() + interval '30 minutes';

  INSERT INTO matches (
    creator_id, game, region, platform, mode, team_size, first_to,
    entry_fee, is_private, status, expires_at,
    team_a_id, captain_a_user_id, host_payment_mode, host_payer_user_id
  ) VALUES (
    v_caller_id, p_game, p_region, p_platform, p_mode, p_team_size, p_first_to,
    p_entry_fee, p_is_private, 'open', v_expires_at,
    p_team_id, v_caller_id, p_payment_mode, v_caller_id
  )
  RETURNING id INTO v_match_id;

  -- 6. Add team members as participants
  INSERT INTO match_participants (match_id, user_id, team_side, joined_at, payment_mode)
  SELECT v_match_id, tm.user_id, 'A', now(), p_payment_mode
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
  LIMIT p_team_size;

  -- 7. Backfill transaction match_id (local to this call)
  UPDATE transactions
  SET match_id = v_match_id
  WHERE match_id IS NULL
    AND type = 'lock'
    AND created_at = v_tx_time
    AND user_id IN (SELECT user_id FROM match_participants WHERE match_id = v_match_id);

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;-- Alignment-only patch: remove usage of non-existent columns
-- Fixes: matches.joiner_payment_mode -> matches.payment_mode_joiner
--        matches.host_payment_mode  -> matches.payment_mode_host
--        match_participants.payment_mode (non-existent) removed from INSERTs
--        ensures no RPC still references transactions.reference_id / matches.updated_at / match_participants.updated_at

CREATE OR REPLACE FUNCTION public.join_team_match(
  p_match_id uuid,
  p_team_id uuid,
  p_payment_mode text DEFAULT 'cover'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_team teams%ROWTYPE;
  v_total_lock numeric;
  v_member_share numeric;
  v_member record;
  v_active_count integer;
  v_ghost record;
  v_block record;
BEGIN
  -- 1. Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;
  IF v_match.team_b_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match already has an opponent');
  END IF;

  -- 2. Verify caller owns the joining team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  IF v_team.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can join matches');
  END IF;

  -- 3. Cannot join own match
  IF v_match.team_a_id = p_team_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot join your own match');
  END IF;

  -- 4. Check team has enough accepted members
  IF (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id AND status = 'accepted') < v_match.team_size THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team does not have enough accepted members');
  END IF;

  -- 5. Check no active match for any team member (STRICT)
  -- Active match statuses: open | ready_check | in_progress | result_pending
  -- Active participant statuses: joined | ready | playing
  FOR v_member IN
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT v_match.team_size
  LOOP
    -- 5a) Auto-clean ghost matches that are objectively terminal by timestamps (safe cleanup)
    FOR v_ghost IN
      SELECT m.id AS match_id
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND (m.expires_at <= now() OR m.finished_at IS NOT NULL)
    LOOP
      UPDATE matches
      SET status = CASE WHEN finished_at IS NOT NULL THEN 'finished' ELSE 'expired' END
      WHERE id = v_ghost.match_id
        AND status IN ('open','ready_check','in_progress','result_pending')
        AND (expires_at <= now() OR finished_at IS NOT NULL);

      UPDATE match_participants
      SET status = 'left'
      WHERE match_id = v_ghost.match_id
        AND status IN ('joined','ready','playing');

      RAISE LOG '[join_team_match ghost-clean] member=% match_id=%', v_member.user_id, v_ghost.match_id;
    END LOOP;

    -- 5b) Strict active-match check (only real active participations block)
    SELECT COUNT(*) INTO v_active_count
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = v_member.user_id
      AND mp.status IN ('joined','ready','playing')
      AND m.status IN ('open','ready_check','in_progress','result_pending')
      AND m.expires_at > now()
      AND m.finished_at IS NULL;

    IF v_active_count > 0 THEN
      -- Logging (temporary) to identify the exact blocking match
      SELECT m.id AS match_id,
             m.status AS match_status,
             mp.status AS participant_status,
             m.expires_at,
             m.finished_at,
             m.created_at
      INTO v_block
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND m.expires_at > now()
        AND m.finished_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1;

      RAISE LOG '[join_team_match busy-check] member=% match_id=% match_status=% participant_status=% expires_at=% finished_at=% created_at=%',
        v_member.user_id,
        v_block.match_id,
        v_block.match_status,
        v_block.participant_status,
        v_block.expires_at,
        v_block.finished_at,
        v_block.created_at;

      RETURN jsonb_build_object('success', false, 'error', 'One or more team members already have an active match');
    END IF;
  END LOOP;

  -- 6. Handle payment based on mode
  IF p_payment_mode = 'cover' THEN
    -- Owner covers entire team: entry_fee * team_size
    v_total_lock := v_match.entry_fee * v_match.team_size;

    UPDATE wallets
    SET balance = balance - v_total_lock,
        locked_balance = locked_balance + v_total_lock,
        updated_at = now()
    WHERE user_id = v_caller_id AND balance >= v_total_lock;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance to cover team entry');
    END IF;

    INSERT INTO transactions (user_id, type, amount, description, match_id)
    VALUES (v_caller_id, 'lock', v_total_lock, 'Match entry locked (covering team)', p_match_id);

  ELSIF p_payment_mode = 'split' THEN
    v_member_share := v_match.entry_fee;

    FOR v_member IN
      SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT v_match.team_size
    LOOP
      UPDATE wallets
      SET balance = balance - v_member_share,
          locked_balance = locked_balance + v_member_share,
          updated_at = now()
      WHERE user_id = v_member.user_id AND balance >= v_member_share;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Member % has insufficient balance', v_member.user_id;
      END IF;

      INSERT INTO transactions (user_id, type, amount, description, match_id)
      VALUES (v_member.user_id, 'lock', v_member_share, 'Match entry locked (split)', p_match_id);
    END LOOP;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment mode');
  END IF;

  -- 7. Update match with team B info
  UPDATE matches SET
    team_b_id = p_team_id,
    captain_b_user_id = v_caller_id,
    payment_mode_joiner = p_payment_mode,
    joiner_payer_user_id = v_caller_id,
    status = 'ready_check',
    ready_check_at = now()
  WHERE id = p_match_id;

  -- 8. Add team B members as participants
  -- NOTE: match_participants has no payment_mode column in schema.
  INSERT INTO match_participants (match_id, user_id, team_side, joined_at)
  SELECT p_match_id, tm.user_id, 'B', now()
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
  LIMIT v_match.team_size;

  RETURN jsonb_build_object('success', true, 'match_id', p_match_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;


-- Overload legacy: create_team_match(p_game, ...) - alignment-only fix for host_payment_mode/payment_mode_host
-- (keeps all business logic intact)
CREATE OR REPLACE FUNCTION public.create_team_match(
  p_team_id uuid,
  p_game text,
  p_region text,
  p_platform text,
  p_mode text,
  p_team_size integer,
  p_first_to integer,
  p_entry_fee numeric,
  p_is_private boolean DEFAULT false,
  p_payment_mode text DEFAULT 'cover'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_team teams%ROWTYPE;
  v_match_id uuid;
  v_expires_at timestamptz;
  v_active_count integer;
  v_total_lock numeric;
  v_member record;
  v_member_share numeric;
  v_ghost record;
  v_block record;
  v_tx_time timestamptz := now();
BEGIN
  -- 1. Verify caller owns the team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  IF v_team.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can create matches');
  END IF;

  -- 2. Check team has enough accepted members
  IF (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id AND status = 'accepted') < p_team_size THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team does not have enough accepted members');
  END IF;

  -- 3. Check no active match for any team member (STRICT)
  FOR v_member IN
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT p_team_size
  LOOP
    -- Auto-clean ghost matches (safe)
    FOR v_ghost IN
      SELECT m.id AS match_id
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND (m.expires_at <= now() OR m.finished_at IS NOT NULL)
    LOOP
      UPDATE matches
      SET status = CASE WHEN finished_at IS NOT NULL THEN 'finished' ELSE 'expired' END
      WHERE id = v_ghost.match_id
        AND status IN ('open','ready_check','in_progress','result_pending')
        AND (expires_at <= now() OR finished_at IS NOT NULL);

      UPDATE match_participants
      SET status = 'left'
      WHERE match_id = v_ghost.match_id
        AND status IN ('joined','ready','playing');

      RAISE LOG '[create_team_match(p_game) ghost-clean] member=% match_id=%', v_member.user_id, v_ghost.match_id;
    END LOOP;

    SELECT COUNT(*) INTO v_active_count
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = v_member.user_id
      AND mp.status IN ('joined','ready','playing')
      AND m.status IN ('open','ready_check','in_progress','result_pending')
      AND m.expires_at > now()
      AND m.finished_at IS NULL;

    IF v_active_count > 0 THEN
      SELECT m.id AS match_id,
             m.status AS match_status,
             mp.status AS participant_status,
             m.expires_at,
             m.finished_at,
             m.created_at
      INTO v_block
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND m.expires_at > now()
        AND m.finished_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1;

      RAISE LOG '[create_team_match(p_game) busy-check] member=% match_id=% match_status=% participant_status=% expires_at=% finished_at=% created_at=%',
        v_member.user_id,
        v_block.match_id,
        v_block.match_status,
        v_block.participant_status,
        v_block.expires_at,
        v_block.finished_at,
        v_block.created_at;

      RETURN jsonb_build_object('success', false, 'error', 'One or more team members already have an active match');
    END IF;
  END LOOP;

  -- 4. Handle payment based on mode
  IF p_payment_mode = 'cover' THEN
    v_total_lock := p_entry_fee * p_team_size;

    UPDATE wallets
    SET balance = balance - v_total_lock,
        locked_balance = locked_balance + v_total_lock,
        updated_at = now()
    WHERE user_id = v_caller_id AND balance >= v_total_lock;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance to cover team entry');
    END IF;

    INSERT INTO transactions (user_id, type, amount, description, match_id, created_at)
    VALUES (v_caller_id, 'lock', v_total_lock, 'Match entry locked (covering team)', NULL, v_tx_time);

  ELSIF p_payment_mode = 'split' THEN
    v_member_share := p_entry_fee;

    FOR v_member IN
      SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT p_team_size
    LOOP
      UPDATE wallets
      SET balance = balance - v_member_share,
          locked_balance = locked_balance + v_member_share,
          updated_at = now()
      WHERE user_id = v_member.user_id AND balance >= v_member_share;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Member % has insufficient balance', v_member.user_id;
      END IF;

      INSERT INTO transactions (user_id, type, amount, description, match_id, created_at)
      VALUES (v_member.user_id, 'lock', v_member_share, 'Match entry locked (split)', NULL, v_tx_time);
    END LOOP;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment mode');
  END IF;

  -- 5. Create match
  v_expires_at := now() + interval '30 minutes';

  INSERT INTO matches (
    creator_id, game, region, platform, mode, team_size, first_to,
    entry_fee, is_private, status, expires_at,
    team_a_id, captain_a_user_id, payment_mode_host, host_payer_user_id
  ) VALUES (
    v_caller_id, p_game, p_region, p_platform, p_mode, p_team_size, p_first_to,
    p_entry_fee, p_is_private, 'open', v_expires_at,
    p_team_id, v_caller_id, p_payment_mode, v_caller_id
  )
  RETURNING id INTO v_match_id;

  -- 6. Add team members as participants
  -- NOTE: match_participants has no payment_mode column in schema.
  INSERT INTO match_participants (match_id, user_id, team_side, joined_at)
  SELECT v_match_id, tm.user_id, 'A', now()
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
  LIMIT p_team_size;

  -- 7. Backfill transaction match_id (local to this call)
  UPDATE transactions
  SET match_id = v_match_id
  WHERE match_id IS NULL
    AND type = 'lock'
    AND created_at = v_tx_time
    AND user_id IN (SELECT user_id FROM match_participants WHERE match_id = v_match_id);

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;-- Patch minima: remove captain-gating in declare_result and use payer columns in finalize_match_payout

CREATE OR REPLACE FUNCTION public.declare_result(
  p_match_id uuid,
  p_result text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_participant match_participants%ROWTYPE;
  v_team_side text;
  v_existing_team_result text;
  v_opponent_result text;
  v_winner_side text;
  v_finalize_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate result value
  IF p_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result. Must be WIN or LOSS');
  END IF;

  -- Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Block terminal states
  IF v_match.status IN ('finished', 'expired', 'cancelled', 'completed', 'admin_resolved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is terminal', 'status', 'terminal');
  END IF;

  -- Check match is in valid state for result declaration
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not in a state that allows result declaration');
  END IF;

  -- Get caller's participation (membership-based authorization)
  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_caller_id;

  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not a participant in this match', 'status', 'not_participant');
  END IF;

  v_team_side := v_participant.team_side;

  -- "Lock after first submit" per team: if any member on that side already declared, return already_submitted.
  SELECT mp.result_choice
  INTO v_existing_team_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.team_side = v_team_side
    AND mp.result_choice IS NOT NULL
  LIMIT 1;

  IF v_existing_team_result IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_submitted',
      'message', 'Il tuo team ha già dichiarato il risultato (bloccato).'
    );
  END IF;

  -- Persist the declaration for the whole team-side (deterministic team source of truth)
  UPDATE match_participants
  SET result_choice = p_result,
      result_at = now()
  WHERE match_id = p_match_id
    AND team_side = v_team_side;

  -- Update match status to result_pending if not already
  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;

  -- Check opponent's result
  SELECT result_choice INTO v_opponent_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side != v_team_side
  LIMIT 1;

  IF v_opponent_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'waiting_opponent', 'message', 'In attesa della dichiarazione avversaria');
  END IF;

  -- Both sides have declared - determine outcome
  IF (p_result = 'WIN' AND v_opponent_result = 'LOSS') THEN
    v_winner_side := v_team_side;
  ELSIF (p_result = 'LOSS' AND v_opponent_result = 'WIN') THEN
    v_winner_side := CASE WHEN v_team_side = 'A' THEN 'B' ELSE 'A' END;
  ELSE
    -- Conflict: both claim WIN or both claim LOSS -> dispute (no payout)
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;

    -- Record dispute in match_results using ONLY existing columns
    INSERT INTO match_results (match_id, status, dispute_reason)
    VALUES (p_match_id, 'disputed', 'Conflicting team declarations')
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      dispute_reason = EXCLUDED.dispute_reason,
      updated_at = now();

    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'message', 'Risultati in conflitto. Un admin esaminerà il match.');
  END IF;

  -- Agreement reached - finalize match and process payout
  SELECT public.finalize_match_payout(p_match_id, v_winner_side) INTO v_finalize_result;

  IF v_finalize_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Finalize returned null', 'status', 'finalize_failed');
  END IF;

  IF NOT COALESCE((v_finalize_result->>'success')::boolean, false) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_finalize_result->>'error', 'Unknown finalize error'),
      'status', 'finalize_failed',
      'message', 'Errore durante la finalizzazione del match. Contatta il supporto.'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'winner_side', v_winner_side,
    'message', 'Match completato con successo!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'status', 'exception');
END;
$$;


CREATE OR REPLACE FUNCTION public.finalize_match_payout(
  p_match_id UUID,
  p_winner_side TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_entry_fee NUMERIC;
  v_team_size INT;
  v_total_pool NUMERIC;
  v_platform_fee NUMERIC;
  v_prize_pool NUMERIC;
  v_loser_side TEXT;
  v_winner_team_id UUID;
  v_loser_team_id UUID;
  v_winner_payment_mode TEXT;
  v_loser_payment_mode TEXT;
  v_winner_payer_user_id UUID;
  v_loser_payer_user_id UUID;
  v_payout_per_member NUMERIC;
  v_participant RECORD;
  v_existing_payout BOOLEAN;
  v_wallet_check RECORD;
  v_expected_locked NUMERIC;
  v_winner_user_id UUID;
  v_loser_user_id UUID;
BEGIN
  IF p_winner_side NOT IN ('A', 'B') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid winner side');
  END IF;

  -- Lock match row
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status NOT IN ('in_progress', 'result_pending', 'disputed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state for finalization');
  END IF;

  -- Idempotency check: prevent double payout
  SELECT EXISTS(
    SELECT 1 FROM transactions
    WHERE match_id = p_match_id AND type = 'payout'
  ) INTO v_existing_payout;

  IF v_existing_payout THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout already processed', 'status', 'already_paid');
  END IF;

  v_entry_fee := v_match.entry_fee;
  v_team_size := v_match.team_size;
  v_loser_side := CASE WHEN p_winner_side = 'A' THEN 'B' ELSE 'A' END;

  -- Keep existing calculation (do not change business rules here)
  v_total_pool := v_entry_fee * v_team_size * 2;
  v_platform_fee := v_total_pool * 0.10;
  v_prize_pool := v_total_pool - v_platform_fee;

  -- Determine payment modes and team IDs
  IF p_winner_side = 'A' THEN
    v_winner_team_id := v_match.team_a_id;
    v_loser_team_id := v_match.team_b_id;
    v_winner_payment_mode := COALESCE(v_match.payment_mode_host, 'cover');
    v_loser_payment_mode := COALESCE(v_match.payment_mode_joiner, 'cover');
  ELSE
    v_winner_team_id := v_match.team_b_id;
    v_loser_team_id := v_match.team_a_id;
    v_winner_payment_mode := COALESCE(v_match.payment_mode_joiner, 'cover');
    v_loser_payment_mode := COALESCE(v_match.payment_mode_host, 'cover');
  END IF;

  -- Cover payer source of truth: host_payer_user_id / joiner_payer_user_id (NOT captain)
  v_winner_payer_user_id := CASE WHEN p_winner_side = 'A' THEN v_match.host_payer_user_id ELSE v_match.joiner_payer_user_id END;
  v_loser_payer_user_id := CASE WHEN v_loser_side = 'A' THEN v_match.host_payer_user_id ELSE v_match.joiner_payer_user_id END;

  -- 1v1 participants (deterministic, not captain-based)
  IF v_team_size = 1 THEN
    SELECT user_id INTO v_winner_user_id
    FROM match_participants
    WHERE match_id = p_match_id AND team_side = p_winner_side
    LIMIT 1;

    SELECT user_id INTO v_loser_user_id
    FROM match_participants
    WHERE match_id = p_match_id AND team_side = v_loser_side
    LIMIT 1;

    IF v_winner_user_id IS NULL OR v_loser_user_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing participants for 1v1');
    END IF;
  END IF;

  -- PRE-CONDITION CHECK: verify locked_balance in cover mode (atomic)
  IF v_team_size > 1 AND v_loser_payment_mode = 'cover' THEN
    IF v_loser_payer_user_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing payer for loser team (cover)');
    END IF;

    v_expected_locked := v_entry_fee * v_team_size;
    SELECT * INTO v_wallet_check FROM wallets
    WHERE user_id = v_loser_payer_user_id FOR UPDATE;

    IF v_wallet_check.locked_balance < v_expected_locked THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient locked balance for loser payer',
        'expected', v_expected_locked,
        'actual', v_wallet_check.locked_balance,
        'payer_id', v_loser_payer_user_id
      );
    END IF;
  END IF;

  IF v_team_size > 1 AND v_winner_payment_mode = 'cover' THEN
    IF v_winner_payer_user_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Missing payer for winner team (cover)');
    END IF;

    v_expected_locked := v_entry_fee * v_team_size;
    SELECT * INTO v_wallet_check FROM wallets
    WHERE user_id = v_winner_payer_user_id FOR UPDATE;

    IF v_wallet_check.locked_balance < v_expected_locked THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Insufficient locked balance for winner payer',
        'expected', v_expected_locked,
        'actual', v_wallet_check.locked_balance,
        'payer_id', v_winner_payer_user_id
      );
    END IF;
  END IF;

  -- ========================================
  -- PROCESS LOSER SIDE (consume locked funds)
  -- ========================================
  IF v_team_size = 1 THEN
    UPDATE wallets
    SET locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = v_loser_user_id AND id IS NOT NULL;

    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Match entry (loss)', 'completed');

    PERFORM record_challenge_event(v_loser_user_id, 'match_completed', p_match_id);

  ELSIF v_loser_payment_mode = 'cover' THEN
    UPDATE wallets
    SET locked_balance = locked_balance - (v_entry_fee * v_team_size),
        updated_at = now()
    WHERE user_id = v_loser_payer_user_id AND id IS NOT NULL;

    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_loser_payer_user_id, 'fee', v_entry_fee * v_team_size, p_match_id, 'Match entry (loss - covered team)', 'completed');

    FOR v_participant IN
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = v_loser_side
    LOOP
      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;

  ELSE
    FOR v_participant IN
      SELECT mp.user_id, w.locked_balance
      FROM match_participants mp
      JOIN wallets w ON w.user_id = mp.user_id
      WHERE mp.match_id = p_match_id AND mp.team_side = v_loser_side
      FOR UPDATE OF w
    LOOP
      IF v_participant.locked_balance < v_entry_fee THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Insufficient locked balance for participant',
          'expected', v_entry_fee,
          'actual', v_participant.locked_balance,
          'user_id', v_participant.user_id
        );
      END IF;

      UPDATE wallets
      SET locked_balance = locked_balance - v_entry_fee,
          updated_at = now()
      WHERE user_id = v_participant.user_id AND id IS NOT NULL;

      INSERT INTO transactions (user_id, type, amount, match_id, description, status)
      VALUES (v_participant.user_id, 'fee', v_entry_fee, p_match_id, 'Match entry (loss)', 'completed');

      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
  END IF;

  -- ========================================
  -- PROCESS WINNER SIDE (payout winnings)
  -- ========================================
  IF v_team_size = 1 THEN
    UPDATE wallets
    SET balance = balance + v_prize_pool,
        locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = v_winner_user_id AND id IS NOT NULL;

    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_winner_user_id, 'payout', v_prize_pool, p_match_id, 'Match winnings', 'completed');

    PERFORM record_challenge_event(v_winner_user_id, 'match_completed', p_match_id);

  ELSIF v_winner_payment_mode = 'cover' THEN
    UPDATE wallets
    SET balance = balance + v_prize_pool,
        locked_balance = locked_balance - (v_entry_fee * v_team_size),
        updated_at = now()
    WHERE user_id = v_winner_payer_user_id AND id IS NOT NULL;

    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_winner_payer_user_id, 'payout', v_prize_pool, p_match_id, 'Match winnings (covered team)', 'completed');

    FOR v_participant IN
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = p_winner_side
    LOOP
      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;

  ELSE
    v_payout_per_member := v_prize_pool / v_team_size;

    FOR v_participant IN
      SELECT mp.user_id, w.locked_balance
      FROM match_participants mp
      JOIN wallets w ON w.user_id = mp.user_id
      WHERE mp.match_id = p_match_id AND mp.team_side = p_winner_side
      FOR UPDATE OF w
    LOOP
      IF v_participant.locked_balance < v_entry_fee THEN
        RETURN jsonb_build_object(
          'success', false,
          'error', 'Insufficient locked balance for winning participant',
          'expected', v_entry_fee,
          'actual', v_participant.locked_balance,
          'user_id', v_participant.user_id
        );
      END IF;

      UPDATE wallets
      SET balance = balance + v_payout_per_member,
          locked_balance = locked_balance - v_entry_fee,
          updated_at = now()
      WHERE user_id = v_participant.user_id AND id IS NOT NULL;

      INSERT INTO transactions (user_id, type, amount, match_id, description, status)
      VALUES (v_participant.user_id, 'payout', v_payout_per_member, p_match_id, 'Match winnings', 'completed');

      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
  END IF;

  -- Platform fee
  UPDATE platform_wallet
  SET balance = balance + v_platform_fee, updated_at = now()
  WHERE id IS NOT NULL;

  INSERT INTO platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);

  -- Update match status
  UPDATE matches
  SET status = 'finished', finished_at = now()
  WHERE id = p_match_id;

  -- Record result
  INSERT INTO match_results (match_id, winner_user_id, winner_team_id, status)
  VALUES (p_match_id, CASE WHEN v_team_size = 1 THEN v_winner_user_id ELSE v_winner_payer_user_id END, v_winner_team_id, 'confirmed')
  ON CONFLICT (match_id) DO UPDATE SET
    winner_user_id = EXCLUDED.winner_user_id,
    winner_team_id = EXCLUDED.winner_team_id,
    status = 'confirmed',
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'message', 'Match finalized successfully',
    'winner_id', CASE WHEN v_team_size = 1 THEN v_winner_user_id ELSE v_winner_payer_user_id END,
    'winner_team_id', v_winner_team_id,
    'prize_pool', v_prize_pool,
    'platform_fee', v_platform_fee
  );
END;
$$;-- Add idempotent finalize + membership-based submit wrapper

CREATE OR REPLACE FUNCTION public.try_finalize_match(
  p_match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match matches%ROWTYPE;
  v_a_result text;
  v_b_result text;
  v_winner_side text;
  v_finalize jsonb;
  v_payout_exists boolean;
  v_total_locked numeric;
  v_expected_locked numeric;
  v_note text;
  v_host_payer uuid;
  v_joiner_payer uuid;
BEGIN
  -- Lock match row to serialize settlement
  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_found', 'error', 'Match not found');
  END IF;

  RAISE NOTICE '[try_finalize_match] start match_id=% status=% team_size=%', v_match.id, v_match.status, v_match.team_size;

  -- If a payout already exists, treat as finalized (idempotent)
  SELECT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.match_id = p_match_id
      AND t.type = 'payout'
      AND t.status = 'completed'
  ) INTO v_payout_exists;

  IF v_payout_exists THEN
    RAISE NOTICE '[try_finalize_match] already paid, normalizing status';
    IF v_match.status NOT IN ('completed','admin_resolved','finished') THEN
      UPDATE matches SET status = 'completed', finished_at = COALESCE(finished_at, now())
      WHERE id = p_match_id;
    END IF;
    RETURN jsonb_build_object('success', true, 'status', 'already_finalized');
  END IF;

  -- Terminal states (no-op)
  IF v_match.status IN ('completed','admin_resolved','finished','expired','cancelled','canceled') THEN
    RETURN jsonb_build_object('success', true, 'status', 'terminal');
  END IF;

  -- Must be in active flow
  IF v_match.status NOT IN ('in_progress','result_pending','disputed') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_state', 'error', 'Match not in finalizable state');
  END IF;

  -- Read team declarations (stored on match_participants)
  SELECT mp.result_choice INTO v_a_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id AND mp.team_side = 'A' AND mp.result_choice IS NOT NULL
  LIMIT 1;

  SELECT mp.result_choice INTO v_b_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id AND mp.team_side = 'B' AND mp.result_choice IS NOT NULL
  LIMIT 1;

  RAISE NOTICE '[try_finalize_match] declarations A=% B=%', v_a_result, v_b_result;

  IF v_a_result IS NULL OR v_b_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'need_other_team');
  END IF;

  -- Determine winner or dispute
  IF v_a_result = 'WIN' AND v_b_result = 'LOSS' THEN
    v_winner_side := 'A';
  ELSIF v_a_result = 'LOSS' AND v_b_result = 'WIN' THEN
    v_winner_side := 'B';
  ELSE
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
    INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
    VALUES (p_match_id, 'disputed', 'Conflicting team declarations', 'try_finalize_match: conflicting declarations')
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      dispute_reason = EXCLUDED.dispute_reason,
      admin_notes = EXCLUDED.admin_notes,
      updated_at = now();

    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'conflict');
  END IF;

  -- Preflight: detect lock inconsistencies (safe-fail to disputed)
  SELECT COALESCE(SUM(t.amount), 0) INTO v_total_locked
  FROM transactions t
  WHERE t.match_id = p_match_id AND t.type = 'lock' AND t.status = 'completed';

  v_expected_locked := (v_match.entry_fee * (COALESCE(v_match.team_size, 1) * 2));

  RAISE NOTICE '[try_finalize_match] locks total=% expected=%', v_total_locked, v_expected_locked;

  IF v_total_locked <> v_expected_locked THEN
    v_note := format('try_finalize_match: lock_mismatch total_locked=%s expected=%s', v_total_locked, v_expected_locked);
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
    INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
    VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_note)
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      dispute_reason = EXCLUDED.dispute_reason,
      admin_notes = EXCLUDED.admin_notes,
      updated_at = now();

    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
  END IF;

  -- Self-heal payer ids for COVER if missing (best-effort, deterministic)
  v_host_payer := v_match.host_payer_user_id;
  v_joiner_payer := v_match.joiner_payer_user_id;

  IF v_match.team_size > 1 THEN
    IF v_match.payment_mode_host = 'cover' AND v_host_payer IS NULL THEN
      -- Prefer creator_id as host payer; fallback to first cover lock
      v_host_payer := v_match.creator_id;
      IF v_host_payer IS NULL THEN
        SELECT t.user_id INTO v_host_payer
        FROM transactions t
        WHERE t.match_id = p_match_id
          AND t.type = 'lock'
          AND t.status = 'completed'
          AND (t.description ILIKE '%cover%')
        ORDER BY t.created_at ASC
        LIMIT 1;
      END IF;

      IF v_host_payer IS NOT NULL THEN
        UPDATE matches SET host_payer_user_id = v_host_payer WHERE id = p_match_id;
      END IF;
    END IF;

    IF v_match.payment_mode_joiner = 'cover' AND v_joiner_payer IS NULL THEN
      -- Try pick cover lock that is not creator_id (if possible)
      SELECT t.user_id INTO v_joiner_payer
      FROM transactions t
      WHERE t.match_id = p_match_id
        AND t.type = 'lock'
        AND t.status = 'completed'
        AND (t.description ILIKE '%cover%')
        AND (v_match.creator_id IS NULL OR t.user_id <> v_match.creator_id)
      ORDER BY t.created_at DESC
      LIMIT 1;

      IF v_joiner_payer IS NOT NULL THEN
        UPDATE matches SET joiner_payer_user_id = v_joiner_payer WHERE id = p_match_id;
      END IF;
    END IF;

    -- If still missing payer in COVER, safe-fail
    IF v_match.payment_mode_host = 'cover' AND (SELECT host_payer_user_id FROM matches WHERE id=p_match_id) IS NULL THEN
      v_note := 'try_finalize_match: missing_host_payer_for_cover';
      UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
      INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
      VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_note)
      ON CONFLICT (match_id) DO UPDATE SET
        status = 'disputed',
        dispute_reason = EXCLUDED.dispute_reason,
        admin_notes = EXCLUDED.admin_notes,
        updated_at = now();
      RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'missing_payer');
    END IF;

    IF v_match.payment_mode_joiner = 'cover' AND (SELECT joiner_payer_user_id FROM matches WHERE id=p_match_id) IS NULL THEN
      v_note := 'try_finalize_match: missing_joiner_payer_for_cover';
      UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
      INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
      VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_note)
      ON CONFLICT (match_id) DO UPDATE SET
        status = 'disputed',
        dispute_reason = EXCLUDED.dispute_reason,
        admin_notes = EXCLUDED.admin_notes,
        updated_at = now();
      RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'missing_payer');
    END IF;
  END IF;

  -- Attempt payout (idempotence is enforced inside finalize_match_payout too, but we also guard above)
  RAISE NOTICE '[try_finalize_match] calling finalize_match_payout winner_side=%', v_winner_side;
  SELECT public.finalize_match_payout(p_match_id, v_winner_side) INTO v_finalize;

  IF v_finalize IS NULL THEN
    RAISE EXCEPTION 'finalize_match_payout returned null';
  END IF;

  IF COALESCE((v_finalize->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'finalize_match_payout failed: %', COALESCE(v_finalize->>'error', v_finalize::text);
  END IF;

  -- Ensure match is terminal
  UPDATE matches
  SET status = 'completed',
      finished_at = COALESCE(finished_at, now())
  WHERE id = p_match_id;

  RAISE NOTICE '[try_finalize_match] completed';

  RETURN jsonb_build_object('success', true, 'status', 'completed', 'winner_side', v_winner_side);

EXCEPTION
  WHEN OTHERS THEN
    -- On any settlement error: dispute + log (as requested)
    v_note := format('try_finalize_match: settlement_error=%s', SQLERRM);

    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;

    INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
    VALUES (p_match_id, 'disputed', 'Settlement error', v_note)
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      dispute_reason = EXCLUDED.dispute_reason,
      admin_notes = EXCLUDED.admin_notes,
      updated_at = now();

    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'settlement_error', 'message', SQLERRM);
END;
$$;


CREATE OR REPLACE FUNCTION public.submit_team_declaration(
  p_match_id uuid,
  p_result text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_participant match_participants%ROWTYPE;
  v_team_side text;
  v_existing_team_result text;
  v_opp_result text;
  v_finalize jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  IF p_result NOT IN ('WIN','LOSS') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_result', 'error', 'Invalid result');
  END IF;

  -- Lock match first to serialize submits as well
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_found', 'error', 'Match not found');
  END IF;

  IF v_match.status IN ('completed','admin_resolved','finished','expired','cancelled','canceled') THEN
    RETURN jsonb_build_object('success', true, 'status', 'terminal');
  END IF;

  IF v_match.status NOT IN ('in_progress','result_pending') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_state', 'error', 'Match not in declaration state');
  END IF;

  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_caller_id;

  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_participant', 'error', 'Not a participant');
  END IF;

  v_team_side := v_participant.team_side;

  -- lock-after-first-submit per team_side
  SELECT mp.result_choice INTO v_existing_team_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.team_side = v_team_side
    AND mp.result_choice IS NOT NULL
  LIMIT 1;

  IF v_existing_team_result IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'already_submitted', 'message', 'Il tuo team ha già dichiarato (bloccato).');
  END IF;

  UPDATE match_participants
  SET result_choice = p_result,
      result_at = now()
  WHERE match_id = p_match_id
    AND team_side = v_team_side;

  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;

  -- Check if opponent already declared
  SELECT mp.result_choice INTO v_opp_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.team_side <> v_team_side
    AND mp.result_choice IS NOT NULL
  LIMIT 1;

  IF v_opp_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'waiting_other_team');
  END IF;

  -- One attempt to finalize (manual retry only means we don't retry on already_submitted)
  SELECT public.try_finalize_match(p_match_id) INTO v_finalize;
  RETURN COALESCE(v_finalize, jsonb_build_object('success', false, 'status', 'finalize_failed'));
END;
$$;-- Fix definitivo payout/finalizzazione: lock checks per-side, payer deterministici, no self-heal, e allineamento create/join team payer+lock.

-- ------------------------------------------------------------
-- Indexes (safe, minimal) for faster finalize checks
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_match_participants_match_side ON public.match_participants(match_id, team_side);
CREATE INDEX IF NOT EXISTS idx_transactions_match_type_status ON public.transactions(match_id, type, status);

-- ------------------------------------------------------------
-- create_team_match (canonical signature used by frontend)
-- - lock/importi POSITIVI
-- - split: lock solo sui partecipanti reali (LIMIT team_size)
-- - cover: host_payer_user_id valorizzato solo se cover, altrimenti NULL
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_team_match(
  p_team_id UUID,
  p_entry_fee NUMERIC,
  p_region TEXT,
  p_platform TEXT,
  p_mode TEXT,
  p_team_size INTEGER,
  p_first_to INTEGER DEFAULT 3,
  p_payment_mode TEXT DEFAULT 'cover',
  p_is_private BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_team RECORD;
  v_member RECORD;
  v_match_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_total_entry NUMERIC;
  v_per_member_fee NUMERIC;
  v_private_code TEXT;
  v_accepted_count INTEGER;
  v_participants UUID[];
  v_lock_amount NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_team_size IS NULL OR p_team_size < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid team_size');
  END IF;

  IF p_payment_mode NOT IN ('cover','split') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment mode');
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  IF v_team.owner_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can create matches');
  END IF;

  SELECT COUNT(*) INTO v_accepted_count
  FROM team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  IF v_accepted_count < p_team_size THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Team needs %s accepted members for %sv%s match (has %s)', p_team_size, p_team_size, p_team_size, v_accepted_count)
    );
  END IF;

  -- Strict busy check (keep existing helper)
  FOR v_member IN
    SELECT tm.user_id
    FROM team_members tm
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LIMIT p_team_size
  LOOP
    IF public.has_active_match(v_member.user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'One or more team members already have an active match');
    END IF;
  END LOOP;

  v_total_entry := p_entry_fee * p_team_size;
  v_per_member_fee := p_entry_fee;

  IF p_is_private THEN
    v_private_code := upper(substr(md5(random()::text), 1, 6));
  END IF;

  -- 30 minutes (keep platform behavior)
  v_expires_at := now() + interval '30 minutes';

  -- Deterministic participant selection (real participants for this match)
  SELECT array_agg(u.user_id) INTO v_participants
  FROM (
    SELECT tm.user_id
    FROM team_members tm
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    ORDER BY (tm.role = 'owner') DESC, tm.created_at ASC
    LIMIT p_team_size
  ) u;

  IF v_participants IS NULL OR array_length(v_participants, 1) <> p_team_size THEN
    RETURN jsonb_build_object('success', false, 'error', 'Could not select participants');
  END IF;

  -- Create match
  INSERT INTO matches (
    creator_id,
    game,
    region,
    platform,
    mode,
    team_size,
    first_to,
    entry_fee,
    is_private,
    private_code,
    expires_at,
    status,
    team_a_id,
    host_payer_user_id,
    payment_mode_host
  ) VALUES (
    v_user_id,
    'FN',
    p_region,
    p_platform,
    p_mode,
    p_team_size,
    p_first_to,
    p_entry_fee,
    p_is_private,
    v_private_code,
    v_expires_at,
    'open',
    p_team_id,
    CASE WHEN p_payment_mode = 'cover' THEN v_user_id ELSE NULL END,
    p_payment_mode
  )
  RETURNING id INTO v_match_id;

  -- Add participants (team A)
  FOREACH v_member.user_id IN ARRAY v_participants
  LOOP
    INSERT INTO match_participants (match_id, user_id, team_side, team_id, status)
    VALUES (v_match_id, v_member.user_id, 'A', p_team_id, 'joined');
  END LOOP;

  -- Lock funds based on payment mode (ONLY for selected participants)
  IF p_payment_mode = 'cover' THEN
    v_lock_amount := v_total_entry;

    UPDATE wallets
    SET balance = balance - v_lock_amount,
        locked_balance = locked_balance + v_lock_amount,
        updated_at = now()
    WHERE user_id = v_user_id AND balance >= v_lock_amount;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', format('Insufficient balance. Need %s coins to cover team', v_lock_amount));
    END IF;

    INSERT INTO transactions (user_id, type, amount, description, match_id, status)
    VALUES (v_user_id, 'lock', v_lock_amount, format('Match entry locked (covering team, size=%s)', p_team_size), v_match_id, 'completed');

  ELSE
    FOREACH v_member.user_id IN ARRAY v_participants
    LOOP
      UPDATE wallets
      SET balance = balance - v_per_member_fee,
          locked_balance = locked_balance + v_per_member_fee,
          updated_at = now()
      WHERE user_id = v_member.user_id AND balance >= v_per_member_fee;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Member % has insufficient balance', v_member.user_id;
      END IF;

      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_member.user_id, 'lock', v_per_member_fee, 'Match entry locked (split)', v_match_id, 'completed');
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', v_match_id,
    'private_code', v_private_code
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ------------------------------------------------------------
-- join_team_match (payer deterministico)
-- - joiner_payer_user_id valorizzato solo se cover, altrimenti NULL
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_team_match(
  p_match_id uuid,
  p_team_id uuid,
  p_payment_mode text DEFAULT 'cover'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_team teams%ROWTYPE;
  v_total_lock numeric;
  v_member_share numeric;
  v_member record;
  v_active_count integer;
  v_ghost record;
  v_block record;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;
  IF v_match.team_b_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match already has an opponent');
  END IF;

  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  IF v_team.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can join matches');
  END IF;

  IF v_match.team_a_id = p_team_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot join your own match');
  END IF;

  IF (SELECT COUNT(*) FROM team_members WHERE team_id = p_team_id AND status = 'accepted') < v_match.team_size THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team does not have enough accepted members');
  END IF;

  FOR v_member IN
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT v_match.team_size
  LOOP
    FOR v_ghost IN
      SELECT m.id AS match_id
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND (m.expires_at <= now() OR m.finished_at IS NOT NULL)
    LOOP
      UPDATE matches
      SET status = CASE WHEN finished_at IS NOT NULL THEN 'finished' ELSE 'expired' END
      WHERE id = v_ghost.match_id
        AND status IN ('open','ready_check','in_progress','result_pending')
        AND (expires_at <= now() OR finished_at IS NOT NULL);

      UPDATE match_participants
      SET status = 'left'
      WHERE match_id = v_ghost.match_id
        AND status IN ('joined','ready','playing');

      RAISE LOG '[join_team_match ghost-clean] member=% match_id=%', v_member.user_id, v_ghost.match_id;
    END LOOP;

    SELECT COUNT(*) INTO v_active_count
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = v_member.user_id
      AND mp.status IN ('joined','ready','playing')
      AND m.status IN ('open','ready_check','in_progress','result_pending')
      AND m.expires_at > now()
      AND m.finished_at IS NULL;

    IF v_active_count > 0 THEN
      SELECT m.id AS match_id,
             m.status AS match_status,
             mp.status AS participant_status,
             m.expires_at,
             m.finished_at,
             m.created_at
      INTO v_block
      FROM match_participants mp
      JOIN matches m ON m.id = mp.match_id
      WHERE mp.user_id = v_member.user_id
        AND mp.status IN ('joined','ready','playing')
        AND m.status IN ('open','ready_check','in_progress','result_pending')
        AND m.expires_at > now()
        AND m.finished_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1;

      RAISE LOG '[join_team_match busy-check] member=% match_id=% match_status=% participant_status=% expires_at=% finished_at=% created_at=%',
        v_member.user_id,
        v_block.match_id,
        v_block.match_status,
        v_block.participant_status,
        v_block.expires_at,
        v_block.finished_at,
        v_block.created_at;

      RETURN jsonb_build_object('success', false, 'error', 'One or more team members already have an active match');
    END IF;
  END LOOP;

  IF p_payment_mode NOT IN ('cover','split') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment mode');
  END IF;

  IF p_payment_mode = 'cover' THEN
    v_total_lock := v_match.entry_fee * v_match.team_size;

    UPDATE wallets
    SET balance = balance - v_total_lock,
        locked_balance = locked_balance + v_total_lock,
        updated_at = now()
    WHERE user_id = v_caller_id AND balance >= v_total_lock;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance to cover team entry');
    END IF;

    INSERT INTO transactions (user_id, type, amount, description, match_id)
    VALUES (v_caller_id, 'lock', v_total_lock, 'Match entry locked (covering team)', p_match_id);

  ELSE
    v_member_share := v_match.entry_fee;

    FOR v_member IN
      SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT v_match.team_size
    LOOP
      UPDATE wallets
      SET balance = balance - v_member_share,
          locked_balance = locked_balance + v_member_share,
          updated_at = now()
      WHERE user_id = v_member.user_id AND balance >= v_member_share;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Member % has insufficient balance', v_member.user_id;
      END IF;

      INSERT INTO transactions (user_id, type, amount, description, match_id)
      VALUES (v_member.user_id, 'lock', v_member_share, 'Match entry locked (split)', p_match_id);
    END LOOP;
  END IF;

  UPDATE matches SET
    team_b_id = p_team_id,
    captain_b_user_id = v_caller_id,
    payment_mode_joiner = p_payment_mode,
    joiner_payer_user_id = CASE WHEN p_payment_mode = 'cover' THEN v_caller_id ELSE NULL END,
    status = 'ready_check',
    ready_check_at = now()
  WHERE id = p_match_id;

  INSERT INTO match_participants (match_id, user_id, team_side, joined_at)
  SELECT p_match_id, tm.user_id, 'B', now()
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
  LIMIT v_match.team_size;

  RETURN jsonb_build_object('success', true, 'match_id', p_match_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- ------------------------------------------------------------
-- try_finalize_match (robust)
-- - per-side participant count check
-- - per-side lock check based on payment_mode and payer columns
-- - no self-heal: if missing payer/lock mismatch -> disputed + admin_notes JSON
-- - idempotent: if payout exists -> already_finalized
-- - never loops: ends in completed / disputed / need_other_team
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.try_finalize_match(
  p_match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match matches%ROWTYPE;
  v_a_result text;
  v_b_result text;
  v_winner_side text;
  v_payout_exists boolean;
  v_total_locked numeric;
  v_expected_locked numeric;

  v_count_a int;
  v_count_b int;

  v_team_size int;
  v_entry_fee numeric;

  v_host_mode text;
  v_joiner_mode text;
  v_host_payer uuid;
  v_joiner_payer uuid;

  v_lock_rows jsonb;
  v_diag jsonb;

  v_finalize jsonb;
  v_note text;
BEGIN
  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_found', 'error', 'Match not found');
  END IF;

  -- Idempotency: payout already exists
  SELECT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.match_id = p_match_id
      AND t.type = 'payout'
      AND t.status = 'completed'
  ) INTO v_payout_exists;

  IF v_payout_exists THEN
    IF v_match.status NOT IN ('completed','admin_resolved','finished') THEN
      UPDATE matches
      SET status = 'completed',
          finished_at = COALESCE(finished_at, now())
      WHERE id = p_match_id;
    END IF;
    RETURN jsonb_build_object('success', true, 'status', 'already_finalized');
  END IF;

  IF v_match.status IN ('completed','admin_resolved','finished','expired','cancelled','canceled') THEN
    RETURN jsonb_build_object('success', true, 'status', 'terminal');
  END IF;

  IF v_match.status NOT IN ('in_progress','result_pending','disputed') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_state', 'error', 'Match not in finalizable state');
  END IF;

  -- Read declarations
  SELECT mp.result_choice INTO v_a_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id AND mp.team_side = 'A' AND mp.result_choice IS NOT NULL
  LIMIT 1;

  SELECT mp.result_choice INTO v_b_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id AND mp.team_side = 'B' AND mp.result_choice IS NOT NULL
  LIMIT 1;

  IF v_a_result IS NULL OR v_b_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'need_other_team');
  END IF;

  IF v_a_result = 'WIN' AND v_b_result = 'LOSS' THEN
    v_winner_side := 'A';
  ELSIF v_a_result = 'LOSS' AND v_b_result = 'WIN' THEN
    v_winner_side := 'B';
  ELSE
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;

    v_diag := jsonb_build_object(
      'reason', 'conflicting_declarations',
      'teamA', v_a_result,
      'teamB', v_b_result
    );

    INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
    VALUES (p_match_id, 'disputed', 'Conflicting team declarations', v_diag::text)
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      dispute_reason = EXCLUDED.dispute_reason,
      admin_notes = EXCLUDED.admin_notes,
      updated_at = now();

    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'conflict');
  END IF;

  v_team_size := COALESCE(v_match.team_size, 1);
  v_entry_fee := v_match.entry_fee;

  -- Team matches: validate participant counts and lock distribution per-side
  IF v_team_size > 1 THEN
    SELECT COUNT(*) INTO v_count_a
    FROM match_participants
    WHERE match_id = p_match_id AND team_side = 'A';

    SELECT COUNT(*) INTO v_count_b
    FROM match_participants
    WHERE match_id = p_match_id AND team_side = 'B';

    IF v_count_a <> v_team_size OR v_count_b <> v_team_size THEN
      UPDATE matches SET status = 'disputed' WHERE id = p_match_id;

      v_diag := jsonb_build_object(
        'reason', 'participant_count_mismatch',
        'expected_per_side', v_team_size,
        'countA', v_count_a,
        'countB', v_count_b
      );

      INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
      VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
      ON CONFLICT (match_id) DO UPDATE SET
        status = 'disputed',
        dispute_reason = EXCLUDED.dispute_reason,
        admin_notes = EXCLUDED.admin_notes,
        updated_at = now();

      RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'participant_count_mismatch');
    END IF;

    v_host_mode := COALESCE(v_match.payment_mode_host, 'cover');
    v_joiner_mode := COALESCE(v_match.payment_mode_joiner, 'cover');
    v_host_payer := v_match.host_payer_user_id;
    v_joiner_payer := v_match.joiner_payer_user_id;

    -- Collect locks for diagnostics
    SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb) INTO v_lock_rows
    FROM (
      SELECT t.user_id, SUM(t.amount) AS locked_amount
      FROM transactions t
      WHERE t.match_id = p_match_id AND t.type = 'lock' AND t.status = 'completed'
      GROUP BY t.user_id
      ORDER BY SUM(t.amount) DESC
    ) x;

    -- Validate payer presence for cover
    IF v_host_mode = 'cover' AND v_host_payer IS NULL THEN
      UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
      v_diag := jsonb_build_object(
        'reason', 'missing_host_payer_for_cover',
        'payment_mode_host', v_host_mode,
        'locks', v_lock_rows
      );
      INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
      VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
      ON CONFLICT (match_id) DO UPDATE SET
        status = 'disputed',
        dispute_reason = EXCLUDED.dispute_reason,
        admin_notes = EXCLUDED.admin_notes,
        updated_at = now();
      RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'missing_payer');
    END IF;

    IF v_joiner_mode = 'cover' AND v_joiner_payer IS NULL THEN
      UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
      v_diag := jsonb_build_object(
        'reason', 'missing_joiner_payer_for_cover',
        'payment_mode_joiner', v_joiner_mode,
        'locks', v_lock_rows
      );
      INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
      VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
      ON CONFLICT (match_id) DO UPDATE SET
        status = 'disputed',
        dispute_reason = EXCLUDED.dispute_reason,
        admin_notes = EXCLUDED.admin_notes,
        updated_at = now();
      RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'missing_payer');
    END IF;

    -- Per-side lock expectations
    -- Cover: only payer has entry_fee*team_size lock
    -- Split: each participant has entry_fee lock

    -- Host side (A)
    IF v_host_mode = 'cover' THEN
      IF COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.match_id=p_match_id AND t.type='lock' AND t.status='completed' AND t.user_id=v_host_payer), 0) <> (v_entry_fee * v_team_size) THEN
        UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
        v_diag := jsonb_build_object(
          'reason', 'lock_mismatch_host_cover',
          'expected', v_entry_fee * v_team_size,
          'payer', v_host_payer,
          'locks', v_lock_rows
        );
        INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
        VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
        ON CONFLICT (match_id) DO UPDATE SET
          status='disputed',
          dispute_reason=EXCLUDED.dispute_reason,
          admin_notes=EXCLUDED.admin_notes,
          updated_at=now();
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
      END IF;

      IF COALESCE((SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.match_id=p_match_id AND t.type='lock' AND t.status='completed'
                    AND t.user_id IN (SELECT mp.user_id FROM match_participants mp WHERE mp.match_id=p_match_id AND mp.team_side='A' AND mp.user_id <> v_host_payer)
                 ), 0) <> 0 THEN
        UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
        v_diag := jsonb_build_object(
          'reason', 'lock_mismatch_host_cover_nonpayer',
          'expected', 0,
          'payer', v_host_payer,
          'locks', v_lock_rows
        );
        INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
        VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
        ON CONFLICT (match_id) DO UPDATE SET
          status='disputed',
          dispute_reason=EXCLUDED.dispute_reason,
          admin_notes=EXCLUDED.admin_notes,
          updated_at=now();
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
      END IF;

    ELSE
      IF COALESCE((SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.match_id=p_match_id AND t.type='lock' AND t.status='completed'
                    AND t.user_id IN (SELECT mp.user_id FROM match_participants mp WHERE mp.match_id=p_match_id AND mp.team_side='A')
                 ), 0) <> (v_entry_fee * v_team_size) THEN
        UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
        v_diag := jsonb_build_object(
          'reason', 'lock_mismatch_host_split_sum',
          'expected', v_entry_fee * v_team_size,
          'locks', v_lock_rows
        );
        INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
        VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
        ON CONFLICT (match_id) DO UPDATE SET
          status='disputed',
          dispute_reason=EXCLUDED.dispute_reason,
          admin_notes=EXCLUDED.admin_notes,
          updated_at=now();
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
      END IF;

      -- each participant exactly entry_fee
      IF EXISTS (
        SELECT 1
        FROM match_participants mp
        WHERE mp.match_id=p_match_id AND mp.team_side='A'
          AND COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.match_id=p_match_id AND t.type='lock' AND t.status='completed' AND t.user_id=mp.user_id), 0) <> v_entry_fee
      ) THEN
        UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
        v_diag := jsonb_build_object(
          'reason', 'lock_mismatch_host_split_per_user',
          'expected_each', v_entry_fee,
          'locks', v_lock_rows
        );
        INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
        VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
        ON CONFLICT (match_id) DO UPDATE SET
          status='disputed',
          dispute_reason=EXCLUDED.dispute_reason,
          admin_notes=EXCLUDED.admin_notes,
          updated_at=now();
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
      END IF;
    END IF;

    -- Joiner side (B)
    IF v_joiner_mode = 'cover' THEN
      IF COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.match_id=p_match_id AND t.type='lock' AND t.status='completed' AND t.user_id=v_joiner_payer), 0) <> (v_entry_fee * v_team_size) THEN
        UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
        v_diag := jsonb_build_object(
          'reason', 'lock_mismatch_joiner_cover',
          'expected', v_entry_fee * v_team_size,
          'payer', v_joiner_payer,
          'locks', v_lock_rows
        );
        INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
        VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
        ON CONFLICT (match_id) DO UPDATE SET
          status='disputed',
          dispute_reason=EXCLUDED.dispute_reason,
          admin_notes=EXCLUDED.admin_notes,
          updated_at=now();
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
      END IF;

      IF COALESCE((SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.match_id=p_match_id AND t.type='lock' AND t.status='completed'
                    AND t.user_id IN (SELECT mp.user_id FROM match_participants mp WHERE mp.match_id=p_match_id AND mp.team_side='B' AND mp.user_id <> v_joiner_payer)
                 ), 0) <> 0 THEN
        UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
        v_diag := jsonb_build_object(
          'reason', 'lock_mismatch_joiner_cover_nonpayer',
          'expected', 0,
          'payer', v_joiner_payer,
          'locks', v_lock_rows
        );
        INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
        VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
        ON CONFLICT (match_id) DO UPDATE SET
          status='disputed',
          dispute_reason=EXCLUDED.dispute_reason,
          admin_notes=EXCLUDED.admin_notes,
          updated_at=now();
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
      END IF;

    ELSE
      IF COALESCE((SELECT SUM(t.amount)
                  FROM transactions t
                  WHERE t.match_id=p_match_id AND t.type='lock' AND t.status='completed'
                    AND t.user_id IN (SELECT mp.user_id FROM match_participants mp WHERE mp.match_id=p_match_id AND mp.team_side='B')
                 ), 0) <> (v_entry_fee * v_team_size) THEN
        UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
        v_diag := jsonb_build_object(
          'reason', 'lock_mismatch_joiner_split_sum',
          'expected', v_entry_fee * v_team_size,
          'locks', v_lock_rows
        );
        INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
        VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
        ON CONFLICT (match_id) DO UPDATE SET
          status='disputed',
          dispute_reason=EXCLUDED.dispute_reason,
          admin_notes=EXCLUDED.admin_notes,
          updated_at=now();
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
      END IF;

      IF EXISTS (
        SELECT 1
        FROM match_participants mp
        WHERE mp.match_id=p_match_id AND mp.team_side='B'
          AND COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.match_id=p_match_id AND t.type='lock' AND t.status='completed' AND t.user_id=mp.user_id), 0) <> v_entry_fee
      ) THEN
        UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
        v_diag := jsonb_build_object(
          'reason', 'lock_mismatch_joiner_split_per_user',
          'expected_each', v_entry_fee,
          'locks', v_lock_rows
        );
        INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
        VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
        ON CONFLICT (match_id) DO UPDATE SET
          status='disputed',
          dispute_reason=EXCLUDED.dispute_reason,
          admin_notes=EXCLUDED.admin_notes,
          updated_at=now();
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
      END IF;
    END IF;
  END IF;

  -- Total lock sanity check (works for 1v1 and team)
  SELECT COALESCE(SUM(t.amount), 0) INTO v_total_locked
  FROM transactions t
  WHERE t.match_id = p_match_id AND t.type = 'lock' AND t.status = 'completed';

  v_expected_locked := (v_entry_fee * (v_team_size * 2));

  IF v_total_locked <> v_expected_locked THEN
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;

    v_diag := jsonb_build_object(
      'reason', 'lock_mismatch_total',
      'total_locked', v_total_locked,
      'expected_total', v_expected_locked,
      'team_size', v_team_size,
      'entry_fee', v_entry_fee
    );

    INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
    VALUES (p_match_id, 'disputed', 'Settlement precondition failed', v_diag::text)
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      dispute_reason = EXCLUDED.dispute_reason,
      admin_notes = EXCLUDED.admin_notes,
      updated_at = now();

    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'lock_mismatch');
  END IF;

  -- Attempt payout
  SELECT public.finalize_match_payout(p_match_id, v_winner_side) INTO v_finalize;

  IF v_finalize IS NULL THEN
    RAISE EXCEPTION 'finalize_match_payout returned null';
  END IF;

  IF COALESCE((v_finalize->>'success')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'finalize_match_payout failed: %', COALESCE(v_finalize->>'error', v_finalize::text);
  END IF;

  UPDATE matches
  SET status = 'completed',
      finished_at = COALESCE(finished_at, now())
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true, 'status', 'completed', 'winner_side', v_winner_side);

EXCEPTION
  WHEN OTHERS THEN
    v_note := format('try_finalize_match: settlement_error=%s', SQLERRM);
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;

    INSERT INTO match_results (match_id, status, dispute_reason, admin_notes)
    VALUES (p_match_id, 'disputed', 'Settlement error', v_note)
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      dispute_reason = EXCLUDED.dispute_reason,
      admin_notes = EXCLUDED.admin_notes,
      updated_at = now();

    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'error_code', 'settlement_error', 'message', SQLERRM);
END;
$$;-- 1) Enriched view for match chat messages (display ADMIN for admin senders)
CREATE OR REPLACE VIEW public.match_chat_messages_view AS
SELECT
  m.id,
  m.match_id,
  m.user_id,
  m.message,
  m.is_system,
  m.created_at,
  CASE
    WHEN public.has_role(m.user_id, 'admin'::public.app_role) THEN 'ADMIN'
    ELSE COALESCE(p.username, 'Unknown')
  END AS display_name,
  p.avatar_url
FROM public.match_chat_messages m
LEFT JOIN public.profiles_public p
  ON p.user_id = m.user_id;

-- 2) Admin force-expire RPC (idempotent, blocks in_progress, no payout)
CREATE OR REPLACE FUNCTION public.admin_force_expire_match(
  p_match_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
  v_participant RECORD;
  v_refund_amount numeric;
  v_refunded_total numeric := 0;
  v_refund_count integer := 0;
  v_already_expired boolean := false;
  v_has_payout boolean := false;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  -- Block in_progress per requisito
  IF v_match.status = 'in_progress' THEN
    RETURN jsonb_build_object('success', false, 'error', 'in_progress_blocked');
  END IF;

  -- If already settled (payout executed) OR terminal win state, reject
  SELECT EXISTS (
    SELECT 1
    FROM public.transactions t
    WHERE t.match_id = p_match_id
      AND t.type = 'payout'
      AND COALESCE(t.status, 'completed') = 'completed'
  ) INTO v_has_payout;

  IF v_has_payout OR v_match.status IN ('completed', 'admin_resolved', 'finished') THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_settled');
  END IF;

  v_already_expired := (v_match.status = 'expired');

  -- Refund logic (idempotent via transactions guard)
  IF v_match.team_size = 1 THEN
    FOR v_participant IN
      SELECT mp.user_id
      FROM public.match_participants mp
      WHERE mp.match_id = p_match_id
    LOOP
      IF NOT EXISTS (
        SELECT 1
        FROM public.transactions t
        WHERE t.match_id = p_match_id
          AND t.user_id = v_participant.user_id
          AND t.type = 'refund'
      ) THEN
        UPDATE public.wallets
        SET balance = balance + v_match.entry_fee,
            locked_balance = locked_balance - v_match.entry_fee
        WHERE user_id = v_participant.user_id
          AND locked_balance >= v_match.entry_fee;

        IF FOUND THEN
          INSERT INTO public.transactions (user_id, type, amount, match_id, description)
          VALUES (v_participant.user_id, 'refund', v_match.entry_fee, p_match_id, 'Match expired - admin force expire');
          v_refunded_total := v_refunded_total + v_match.entry_fee;
          v_refund_count := v_refund_count + 1;
        END IF;
      END IF;
    END LOOP;

  ELSE
    -- Team A (host)
    IF v_match.payment_mode_host = 'cover' THEN
      v_refund_amount := v_match.entry_fee * v_match.team_size;
      IF v_match.host_payer_user_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.transactions t
          WHERE t.match_id = p_match_id
            AND t.user_id = v_match.host_payer_user_id
            AND t.type = 'refund'
        ) THEN
          UPDATE public.wallets
          SET balance = balance + v_refund_amount,
              locked_balance = locked_balance - v_refund_amount
          WHERE user_id = v_match.host_payer_user_id
            AND locked_balance >= v_refund_amount;

          IF FOUND THEN
            INSERT INTO public.transactions (user_id, type, amount, match_id, description)
            VALUES (v_match.host_payer_user_id, 'refund', v_refund_amount, p_match_id, 'Match expired - admin force expire (host cover)');
            v_refunded_total := v_refunded_total + v_refund_amount;
            v_refund_count := v_refund_count + 1;
          END IF;
        END IF;
      END IF;
    ELSE
      FOR v_participant IN
        SELECT mp.user_id
        FROM public.match_participants mp
        WHERE mp.match_id = p_match_id
          AND mp.team_side = 'A'
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM public.transactions t
          WHERE t.match_id = p_match_id
            AND t.user_id = v_participant.user_id
            AND t.type = 'refund'
        ) THEN
          UPDATE public.wallets
          SET balance = balance + v_match.entry_fee,
              locked_balance = locked_balance - v_match.entry_fee
          WHERE user_id = v_participant.user_id
            AND locked_balance >= v_match.entry_fee;

          IF FOUND THEN
            INSERT INTO public.transactions (user_id, type, amount, match_id, description)
            VALUES (v_participant.user_id, 'refund', v_match.entry_fee, p_match_id, 'Match expired - admin force expire (host split)');
            v_refunded_total := v_refunded_total + v_match.entry_fee;
            v_refund_count := v_refund_count + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;

    -- Team B (joiner)
    IF v_match.payment_mode_joiner = 'cover' THEN
      v_refund_amount := v_match.entry_fee * v_match.team_size;
      IF v_match.joiner_payer_user_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1
          FROM public.transactions t
          WHERE t.match_id = p_match_id
            AND t.user_id = v_match.joiner_payer_user_id
            AND t.type = 'refund'
        ) THEN
          UPDATE public.wallets
          SET balance = balance + v_refund_amount,
              locked_balance = locked_balance - v_refund_amount
          WHERE user_id = v_match.joiner_payer_user_id
            AND locked_balance >= v_refund_amount;

          IF FOUND THEN
            INSERT INTO public.transactions (user_id, type, amount, match_id, description)
            VALUES (v_match.joiner_payer_user_id, 'refund', v_refund_amount, p_match_id, 'Match expired - admin force expire (joiner cover)');
            v_refunded_total := v_refunded_total + v_refund_amount;
            v_refund_count := v_refund_count + 1;
          END IF;
        END IF;
      END IF;
    ELSE
      FOR v_participant IN
        SELECT mp.user_id
        FROM public.match_participants mp
        WHERE mp.match_id = p_match_id
          AND mp.team_side = 'B'
      LOOP
        IF NOT EXISTS (
          SELECT 1
          FROM public.transactions t
          WHERE t.match_id = p_match_id
            AND t.user_id = v_participant.user_id
            AND t.type = 'refund'
        ) THEN
          UPDATE public.wallets
          SET balance = balance + v_match.entry_fee,
              locked_balance = locked_balance - v_match.entry_fee
          WHERE user_id = v_participant.user_id
            AND locked_balance >= v_match.entry_fee;

          IF FOUND THEN
            INSERT INTO public.transactions (user_id, type, amount, match_id, description)
            VALUES (v_participant.user_id, 'refund', v_match.entry_fee, p_match_id, 'Match expired - admin force expire (joiner split)');
            v_refunded_total := v_refunded_total + v_match.entry_fee;
            v_refund_count := v_refund_count + 1;
          END IF;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Update match status (archive/hide)
  UPDATE public.matches
  SET status = 'expired',
      finished_at = COALESCE(finished_at, now())
  WHERE id = p_match_id;

  -- Append admin note to match_results if present, else create a minimal row
  IF EXISTS (SELECT 1 FROM public.match_results r WHERE r.match_id = p_match_id) THEN
    UPDATE public.match_results
    SET admin_notes = COALESCE(admin_notes, '')
      || CASE WHEN COALESCE(admin_notes, '') = '' THEN '' ELSE E'\n' END
      || 'Force expire by admin at ' || now()::text
      || CASE WHEN p_reason IS NOT NULL AND btrim(p_reason) <> '' THEN E' — ' || p_reason ELSE '' END
    WHERE match_id = p_match_id;
  ELSE
    INSERT INTO public.match_results (match_id, admin_notes)
    VALUES (
      p_match_id,
      'Force expire by admin at ' || now()::text
      || CASE WHEN p_reason IS NOT NULL AND btrim(p_reason) <> '' THEN E' — ' || p_reason ELSE '' END
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id,
    'status', 'expired',
    'already_expired', v_already_expired,
    'refund_count', v_refund_count,
    'refunded_total', v_refunded_total
  );
END;
$$;-- Fix linter: make the view explicitly SECURITY INVOKER
DROP VIEW IF EXISTS public.match_chat_messages_view;

CREATE VIEW public.match_chat_messages_view
WITH (security_invoker = true)
AS
SELECT
  m.id,
  m.match_id,
  m.user_id,
  m.message,
  m.is_system,
  m.created_at,
  CASE
    WHEN public.has_role(m.user_id, 'admin'::public.app_role) THEN 'ADMIN'
    ELSE COALESCE(p.username, 'Unknown')
  END AS display_name,
  p.avatar_url
FROM public.match_chat_messages m
LEFT JOIN public.profiles_public p
  ON p.user_id = m.user_id;BEGIN;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.match_proofs ENABLE ROW LEVEL SECURITY;

-- Additional SELECT policy for admins (safe OR with existing SELECT policies)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'match_proofs'
      AND policyname = 'Admins can view all proofs'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Admins can view all proofs"
      ON public.match_proofs
      FOR SELECT
      USING (public.is_admin());
    $p$;
  END IF;
END$$;

COMMIT;-- ================================================
-- FIX 1: admin_resolve_match_v3 - Team-aware resolution with proper locked_balance handling
-- FIX 2: auto_refund_expired_matches - Automatic refund after 30 minutes
-- FIX 3: get_admin_issue_stats - Correct expired_with_locks count
-- FIX 4: admin_fix_orphan_locked_balance - Data repair for stuck funds
-- ================================================

-- =============================================================
-- FUNCTION: admin_resolve_match_v3
-- Replaces admin_resolve_match_v2 for ALL match types (1v1 and team)
-- Correctly handles cover/split payment modes and unlocks locked_balance
-- =============================================================
CREATE OR REPLACE FUNCTION public.admin_resolve_match_v3(
  p_match_id UUID,
  p_action TEXT,   -- 'TEAM_A_WIN', 'TEAM_B_WIN', 'REFUND_BOTH'
  p_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_entry_fee NUMERIC;
  v_team_size INT;
  v_total_pool NUMERIC;
  v_platform_fee NUMERIC;
  v_prize_pool NUMERIC;
  v_winner_side TEXT;
  v_loser_side TEXT;
  v_winner_payment_mode TEXT;
  v_loser_payment_mode TEXT;
  v_winner_payer_user_id UUID;
  v_loser_payer_user_id UUID;
  v_payout_per_member NUMERIC;
  v_participant RECORD;
  v_existing_payout BOOLEAN;
  v_amount_to_unlock NUMERIC;
  v_refund_count INT := 0;
  v_total_refunded NUMERIC := 0;
BEGIN
  -- Admin check
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  -- Validate action
  IF p_action NOT IN ('TEAM_A_WIN', 'TEAM_B_WIN', 'REFUND_BOTH') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Use TEAM_A_WIN, TEAM_B_WIN, or REFUND_BOTH');
  END IF;

  -- Notes required for win/loss resolution
  IF p_action IN ('TEAM_A_WIN', 'TEAM_B_WIN') AND (p_notes IS NULL OR trim(p_notes) = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin notes are required for win/loss resolution');
  END IF;

  -- Lock match row
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Check valid state
  IF v_match.status NOT IN ('disputed', 'in_progress', 'result_pending', 'finished', 'expired') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state for admin resolution', 'current_status', v_match.status);
  END IF;

  -- Idempotency check
  SELECT EXISTS(
    SELECT 1 FROM transactions
    WHERE match_id = p_match_id AND type = 'payout'
  ) INTO v_existing_payout;

  IF v_existing_payout THEN
    RETURN jsonb_build_object('success', true, 'already_resolved', true, 'message', 'Match already had payout processed');
  END IF;

  v_entry_fee := v_match.entry_fee;
  v_team_size := COALESCE(v_match.team_size, 1);
  v_total_pool := v_entry_fee * v_team_size * 2;
  v_platform_fee := v_total_pool * 0.10;
  v_prize_pool := v_total_pool - v_platform_fee;

  -- ========================
  -- REFUND_BOTH: Full refund to all payers
  -- ========================
  IF p_action = 'REFUND_BOTH' THEN
    -- Check if already refunded
    IF EXISTS (SELECT 1 FROM transactions WHERE match_id = p_match_id AND type = 'refund') THEN
      RETURN jsonb_build_object('success', true, 'already_refunded', true);
    END IF;

    -- Refund Team A (Host)
    IF COALESCE(v_match.payment_mode_host, 'cover') = 'cover' THEN
      -- Cover mode: refund to single payer
      IF v_match.host_payer_user_id IS NOT NULL THEN
        v_amount_to_unlock := v_entry_fee * v_team_size;
        
        UPDATE wallets SET
          locked_balance = GREATEST(0, locked_balance - v_amount_to_unlock),
          balance = balance + v_amount_to_unlock
        WHERE user_id = v_match.host_payer_user_id;

        INSERT INTO transactions (user_id, match_id, type, amount, description)
        VALUES (v_match.host_payer_user_id, p_match_id, 'refund', v_amount_to_unlock, 'Admin refund: ' || COALESCE(p_notes, 'match cancelled'));

        v_refund_count := v_refund_count + 1;
        v_total_refunded := v_total_refunded + v_amount_to_unlock;
      END IF;
    ELSE
      -- Split mode: refund each participant
      FOR v_participant IN
        SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = 'A'
      LOOP
        UPDATE wallets SET
          locked_balance = GREATEST(0, locked_balance - v_entry_fee),
          balance = balance + v_entry_fee
        WHERE user_id = v_participant.user_id;

        INSERT INTO transactions (user_id, match_id, type, amount, description)
        VALUES (v_participant.user_id, p_match_id, 'refund', v_entry_fee, 'Admin refund: ' || COALESCE(p_notes, 'match cancelled'));

        v_refund_count := v_refund_count + 1;
        v_total_refunded := v_total_refunded + v_entry_fee;
      END LOOP;
    END IF;

    -- Refund Team B (Joiner)
    IF COALESCE(v_match.payment_mode_joiner, 'cover') = 'cover' THEN
      IF v_match.joiner_payer_user_id IS NOT NULL THEN
        v_amount_to_unlock := v_entry_fee * v_team_size;
        
        UPDATE wallets SET
          locked_balance = GREATEST(0, locked_balance - v_amount_to_unlock),
          balance = balance + v_amount_to_unlock
        WHERE user_id = v_match.joiner_payer_user_id;

        INSERT INTO transactions (user_id, match_id, type, amount, description)
        VALUES (v_match.joiner_payer_user_id, p_match_id, 'refund', v_amount_to_unlock, 'Admin refund: ' || COALESCE(p_notes, 'match cancelled'));

        v_refund_count := v_refund_count + 1;
        v_total_refunded := v_total_refunded + v_amount_to_unlock;
      END IF;
    ELSE
      FOR v_participant IN
        SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = 'B'
      LOOP
        UPDATE wallets SET
          locked_balance = GREATEST(0, locked_balance - v_entry_fee),
          balance = balance + v_entry_fee
        WHERE user_id = v_participant.user_id;

        INSERT INTO transactions (user_id, match_id, type, amount, description)
        VALUES (v_participant.user_id, p_match_id, 'refund', v_entry_fee, 'Admin refund: ' || COALESCE(p_notes, 'match cancelled'));

        v_refund_count := v_refund_count + 1;
        v_total_refunded := v_total_refunded + v_entry_fee;
      END LOOP;
    END IF;

    -- Update match status
    UPDATE matches SET status = 'admin_resolved', finished_at = now() WHERE id = p_match_id;

    -- Update match result with admin notes
    INSERT INTO match_results (match_id, status, admin_notes, resolved_by)
    VALUES (p_match_id, 'resolved', 'REFUND: ' || COALESCE(p_notes, 'Admin cancelled match'), auth.uid())
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'resolved',
      admin_notes = 'REFUND: ' || COALESCE(p_notes, 'Admin cancelled match'),
      resolved_by = auth.uid(),
      updated_at = now();

    -- Log admin action
    INSERT INTO admin_action_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (auth.uid(), 'resolve_match', 'match', p_match_id, 
      jsonb_build_object('action', 'REFUND_BOTH', 'notes', p_notes, 'refunded', v_total_refunded));

    RETURN jsonb_build_object(
      'success', true,
      'action', 'REFUND_BOTH',
      'refund_count', v_refund_count,
      'total_refunded', v_total_refunded
    );
  END IF;

  -- ========================
  -- WIN/LOSS: Award prize to winner, deduct from loser
  -- ========================
  v_winner_side := CASE WHEN p_action = 'TEAM_A_WIN' THEN 'A' ELSE 'B' END;
  v_loser_side := CASE WHEN v_winner_side = 'A' THEN 'B' ELSE 'A' END;

  -- Determine payment modes
  v_winner_payment_mode := CASE WHEN v_winner_side = 'A' 
    THEN COALESCE(v_match.payment_mode_host, 'cover') 
    ELSE COALESCE(v_match.payment_mode_joiner, 'cover') 
  END;
  v_loser_payment_mode := CASE WHEN v_loser_side = 'A' 
    THEN COALESCE(v_match.payment_mode_host, 'cover') 
    ELSE COALESCE(v_match.payment_mode_joiner, 'cover') 
  END;

  -- Get payer IDs
  v_winner_payer_user_id := CASE WHEN v_winner_side = 'A' 
    THEN v_match.host_payer_user_id 
    ELSE v_match.joiner_payer_user_id 
  END;
  v_loser_payer_user_id := CASE WHEN v_loser_side = 'A' 
    THEN v_match.host_payer_user_id 
    ELSE v_match.joiner_payer_user_id 
  END;

  -- ========================
  -- Step 1: Unlock loser's funds (fee transaction)
  -- ========================
  IF v_loser_payment_mode = 'cover' THEN
    IF v_loser_payer_user_id IS NOT NULL THEN
      v_amount_to_unlock := v_entry_fee * v_team_size;
      UPDATE wallets SET locked_balance = GREATEST(0, locked_balance - v_amount_to_unlock)
      WHERE user_id = v_loser_payer_user_id;

      INSERT INTO transactions (user_id, match_id, type, amount, description)
      VALUES (v_loser_payer_user_id, p_match_id, 'fee', v_amount_to_unlock, 'Match lost - entry fee');
    END IF;
  ELSE
    -- Split mode: unlock from each loser participant
    FOR v_participant IN
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = v_loser_side
    LOOP
      UPDATE wallets SET locked_balance = GREATEST(0, locked_balance - v_entry_fee)
      WHERE user_id = v_participant.user_id;

      INSERT INTO transactions (user_id, match_id, type, amount, description)
      VALUES (v_participant.user_id, p_match_id, 'fee', v_entry_fee, 'Match lost - entry fee');
    END LOOP;
  END IF;

  -- ========================
  -- Step 2: Unlock winner's funds (they get them back + prize)
  -- ========================
  IF v_winner_payment_mode = 'cover' THEN
    IF v_winner_payer_user_id IS NOT NULL THEN
      v_amount_to_unlock := v_entry_fee * v_team_size;
      -- Unlock their stake and add prize
      UPDATE wallets SET 
        locked_balance = GREATEST(0, locked_balance - v_amount_to_unlock),
        balance = balance + v_prize_pool
      WHERE user_id = v_winner_payer_user_id;

      INSERT INTO transactions (user_id, match_id, type, amount, description)
      VALUES (v_winner_payer_user_id, p_match_id, 'payout', v_prize_pool, 'Match won - prize pool');
    END IF;
  ELSE
    -- Split mode: unlock and distribute prize equally
    v_payout_per_member := v_prize_pool / v_team_size;
    
    FOR v_participant IN
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = v_winner_side
    LOOP
      UPDATE wallets SET 
        locked_balance = GREATEST(0, locked_balance - v_entry_fee),
        balance = balance + v_payout_per_member
      WHERE user_id = v_participant.user_id;

      INSERT INTO transactions (user_id, match_id, type, amount, description)
      VALUES (v_participant.user_id, p_match_id, 'payout', v_payout_per_member, 'Match won - prize share');
    END LOOP;
  END IF;

  -- ========================
  -- Step 3: Record platform fee
  -- ========================
  INSERT INTO platform_earnings (match_id, amount)
  VALUES (p_match_id, v_platform_fee);

  -- ========================
  -- Step 4: Update match and result
  -- ========================
  UPDATE matches SET status = 'admin_resolved', finished_at = now() WHERE id = p_match_id;

  INSERT INTO match_results (match_id, status, admin_notes, resolved_by, winner_team_id)
  VALUES (
    p_match_id, 
    'resolved', 
    p_action || ': ' || COALESCE(p_notes, ''),
    auth.uid(),
    CASE WHEN v_winner_side = 'A' THEN v_match.team_a_id ELSE v_match.team_b_id END
  )
  ON CONFLICT (match_id) DO UPDATE SET
    status = 'resolved',
    admin_notes = p_action || ': ' || COALESCE(p_notes, ''),
    resolved_by = auth.uid(),
    winner_team_id = CASE WHEN v_winner_side = 'A' THEN v_match.team_a_id ELSE v_match.team_b_id END,
    updated_at = now();

  -- Log admin action
  INSERT INTO admin_action_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'resolve_match', 'match', p_match_id, 
    jsonb_build_object(
      'action', p_action, 
      'notes', p_notes, 
      'prize_pool', v_prize_pool,
      'platform_fee', v_platform_fee,
      'winner_side', v_winner_side
    ));

  RETURN jsonb_build_object(
    'success', true,
    'action', p_action,
    'winner_side', v_winner_side,
    'prize_pool', v_prize_pool,
    'platform_fee', v_platform_fee
  );
END;
$$;

-- =============================================================
-- FUNCTION: auto_refund_expired_matches
-- Automatically refunds matches expired for more than 30 minutes
-- =============================================================
CREATE OR REPLACE FUNCTION public.auto_refund_expired_matches()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_count INT := 0;
  v_total_refunded NUMERIC := 0;
  v_result jsonb;
BEGIN
  FOR v_match IN
    SELECT m.*
    FROM matches m
    WHERE m.status = 'expired'
      -- Expired more than 30 minutes ago
      AND COALESCE(m.finished_at, m.created_at) < now() - interval '30 minutes'
      -- Has lock transactions (funds were actually locked)
      AND EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.match_id = m.id AND t.type = 'lock'
      )
      -- Does NOT have refund transactions yet
      AND NOT EXISTS (
        SELECT 1 FROM transactions t
        WHERE t.match_id = m.id AND t.type = 'refund'
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      -- Use existing admin_force_expire_match which handles all cases
      SELECT public.admin_force_expire_match(v_match.id, 'auto_refund_expired_after_30m') INTO v_result;
      
      IF (v_result->>'success')::boolean THEN
        v_count := v_count + 1;
        v_total_refunded := v_total_refunded + COALESCE((v_result->>'refunded_total')::numeric, 0);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Log error but continue processing other matches
      RAISE WARNING 'auto_refund_expired_matches: Failed to process match %: %', v_match.id, SQLERRM;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'processed', v_count,
    'total_refunded', v_total_refunded,
    'processed_at', now()
  );
END;
$$;

-- =============================================================
-- FUNCTION: get_admin_issue_stats (UPDATED)
-- Fixed: expired_with_locks now correctly counts matches with lock but no refund
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_admin_issue_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_disputed INT;
  v_expired_with_locks INT;
  v_stuck_ready_check INT;
  v_inconsistent_results INT;
  v_total INT;
BEGIN
  -- Disputed matches
  SELECT COUNT(*) INTO v_disputed
  FROM matches WHERE status = 'disputed';

  -- Expired matches with funds still locked (has lock tx but no refund tx)
  SELECT COUNT(DISTINCT m.id) INTO v_expired_with_locks
  FROM matches m
  WHERE m.status = 'expired'
    AND EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.match_id = m.id AND t.type = 'lock'
    )
    AND NOT EXISTS (
      SELECT 1 FROM transactions t
      WHERE t.match_id = m.id AND t.type = 'refund'
    );

  -- Stuck ready check (>10 minutes without starting)
  SELECT COUNT(*) INTO v_stuck_ready_check
  FROM matches
  WHERE status = 'ready_check'
    AND started_at IS NULL
    AND ready_check_at < now() - interval '10 minutes';

  -- Inconsistent results (both teams declared same result)
  SELECT COUNT(DISTINCT m.id) INTO v_inconsistent_results
  FROM matches m
  JOIN match_participants mp_a ON mp_a.match_id = m.id AND mp_a.team_side = 'A' AND mp_a.result_choice IS NOT NULL
  JOIN match_participants mp_b ON mp_b.match_id = m.id AND mp_b.team_side = 'B' AND mp_b.result_choice IS NOT NULL
  WHERE m.status IN ('result_pending', 'finished')
    AND mp_a.result_choice = mp_b.result_choice;

  v_total := v_disputed + v_expired_with_locks + v_stuck_ready_check + v_inconsistent_results;

  RETURN jsonb_build_object(
    'disputed', v_disputed,
    'expired_with_locks', v_expired_with_locks,
    'stuck_ready_check', v_stuck_ready_check,
    'inconsistent_results', v_inconsistent_results,
    'total', v_total
  );
END;
$$;

-- =============================================================
-- FUNCTION: admin_fix_orphan_locked_balance
-- One-time repair for users with locked_balance but no active matches
-- =============================================================
CREATE OR REPLACE FUNCTION public.admin_fix_orphan_locked_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_orphan_amount NUMERIC;
  v_fixed_count INT := 0;
  v_fixed_users UUID[] := ARRAY[]::UUID[];
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Find wallets with locked balance but no active matches
  FOR v_wallet IN
    SELECT w.user_id, w.locked_balance, w.balance
    FROM wallets w
    WHERE w.locked_balance > 0
      AND NOT EXISTS (
        SELECT 1 FROM match_participants mp
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = w.user_id
        AND m.status NOT IN ('finished', 'completed', 'admin_resolved', 'expired', 'canceled')
      )
    FOR UPDATE
  LOOP
    -- Calculate what should be unlocked by checking transaction history
    -- Sum of locks minus sum of (refunds + fees + payouts received)
    SELECT GREATEST(0, 
      COALESCE(SUM(CASE WHEN t.type = 'lock' THEN t.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.type IN ('refund', 'fee') THEN t.amount ELSE 0 END), 0)
    )
    INTO v_orphan_amount
    FROM transactions t
    WHERE t.user_id = v_wallet.user_id
      AND t.match_id IS NOT NULL;

    -- Only fix if calculated orphan matches actual locked balance
    IF v_orphan_amount > 0 AND v_orphan_amount <= v_wallet.locked_balance THEN
      UPDATE wallets
      SET locked_balance = locked_balance - v_orphan_amount,
          balance = balance + v_orphan_amount
      WHERE user_id = v_wallet.user_id;

      INSERT INTO transactions (user_id, type, amount, description)
      VALUES (v_wallet.user_id, 'refund', v_orphan_amount, 'Admin fix: orphan locked balance restored');

      v_fixed_count := v_fixed_count + 1;
      v_fixed_users := array_append(v_fixed_users, v_wallet.user_id);
    END IF;
  END LOOP;

  -- Log admin action
  IF v_fixed_count > 0 THEN
    INSERT INTO admin_action_logs (admin_user_id, action_type, target_type, target_id, details)
    VALUES (auth.uid(), 'fix_orphan_balance', 'system', NULL, 
      jsonb_build_object('fixed_count', v_fixed_count, 'fixed_users', v_fixed_users));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_wallets', v_fixed_count,
    'fixed_users', v_fixed_users
  );
END;
$$;-- ============================================================
-- PHASE 1: admin_purge_legacy_match - Process single legacy match
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_purge_legacy_match(p_match_id uuid, p_reason text DEFAULT 'legacy cleanup')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_lock_tx RECORD;
  v_payers uuid[];
  v_payer_id uuid;
  v_refunded_count int := 0;
  v_refunded_total numeric := 0;
  v_already_refunded boolean := false;
  v_wallet RECORD;
BEGIN
  -- Admin check
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  -- Check if already has payout (match was properly resolved)
  IF EXISTS (SELECT 1 FROM transactions WHERE match_id = p_match_id AND type = 'payout') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_already_paid_out', 'match_id', p_match_id);
  END IF;

  -- Find all unique payers from lock transactions for this match
  SELECT array_agg(DISTINCT user_id) INTO v_payers
  FROM transactions
  WHERE match_id = p_match_id AND type = 'lock';

  IF v_payers IS NULL OR array_length(v_payers, 1) = 0 THEN
    -- No locks found, nothing to refund
    -- Just update status if needed
    IF v_match.status NOT IN ('finished', 'expired', 'canceled', 'admin_resolved') THEN
      UPDATE matches SET status = 'expired', finished_at = now() WHERE id = p_match_id;
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'no_locks_found', 'match_id', p_match_id);
  END IF;

  -- Process each payer
  FOREACH v_payer_id IN ARRAY v_payers
  LOOP
    -- Check if this payer already got a refund for this match
    IF EXISTS (
      SELECT 1 FROM transactions 
      WHERE match_id = p_match_id 
        AND user_id = v_payer_id 
        AND type = 'refund'
    ) THEN
      CONTINUE; -- Skip, already refunded
    END IF;

    -- Calculate total locked by this payer for this match
    SELECT COALESCE(SUM(amount), 0) INTO v_lock_tx.amount
    FROM transactions
    WHERE match_id = p_match_id 
      AND user_id = v_payer_id 
      AND type = 'lock';

    IF v_lock_tx.amount <= 0 THEN
      CONTINUE;
    END IF;

    -- Lock wallet and update balances
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_payer_id FOR UPDATE;
    
    IF v_wallet IS NULL THEN
      CONTINUE;
    END IF;

    -- Decrease locked_balance (clamped to 0)
    UPDATE wallets
    SET locked_balance = GREATEST(0, locked_balance - v_lock_tx.amount),
        balance = balance + v_lock_tx.amount,
        updated_at = now()
    WHERE user_id = v_payer_id;

    -- Insert refund transaction
    INSERT INTO transactions (user_id, match_id, type, amount, description, status)
    VALUES (v_payer_id, p_match_id, 'refund', v_lock_tx.amount, 'Legacy cleanup: ' || p_reason, 'completed');

    v_refunded_count := v_refunded_count + 1;
    v_refunded_total := v_refunded_total + v_lock_tx.amount;
  END LOOP;

  -- Update match status to expired if not already terminal
  IF v_match.status NOT IN ('finished', 'expired', 'canceled', 'admin_resolved') THEN
    UPDATE matches 
    SET status = 'expired', 
        finished_at = now()
    WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id,
    'refunded_count', v_refunded_count,
    'refunded_total', v_refunded_total,
    'previous_status', v_match.status
  );
END;
$$;

-- ============================================================
-- PHASE 2: admin_cleanup_legacy_stuck_matches - Batch processing
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_cleanup_legacy_stuck_matches(p_cutoff_minutes int DEFAULT 35)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_result jsonb;
  v_processed_ids uuid[] := ARRAY[]::uuid[];
  v_non_terminal_count int := 0;
  v_terminal_stuck_count int := 0;
  v_total_refunded numeric := 0;
  v_auto_refund_result jsonb;
  v_orphan_result jsonb;
BEGIN
  -- Admin check
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- STEP 1: Process non-terminal matches that are old and have locks without refunds
  FOR v_match IN
    SELECT DISTINCT m.id, m.status, m.created_at
    FROM matches m
    WHERE m.status IN ('open', 'joined', 'full', 'ready_check', 'in_progress', 'result_pending', 'disputed')
      AND m.created_at < now() - (p_cutoff_minutes || ' minutes')::interval
      -- Has lock transactions
      AND EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'lock'
      )
      -- Does NOT have payout (not properly resolved)
      AND NOT EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'payout'
      )
    ORDER BY m.created_at ASC
    LIMIT 100 -- Safety limit
  LOOP
    SELECT admin_purge_legacy_match(v_match.id, 'auto-expire non-terminal legacy') INTO v_result;
    IF (v_result->>'success')::boolean THEN
      v_processed_ids := array_append(v_processed_ids, v_match.id);
      v_non_terminal_count := v_non_terminal_count + 1;
      v_total_refunded := v_total_refunded + COALESCE((v_result->>'refunded_total')::numeric, 0);
    END IF;
  END LOOP;

  -- STEP 2: Process terminal matches that still have stuck funds (lock without refund/payout)
  FOR v_match IN
    SELECT DISTINCT m.id, m.status
    FROM matches m
    WHERE m.status IN ('finished', 'expired', 'canceled', 'admin_resolved')
      -- Has lock transactions
      AND EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'lock'
      )
      -- Does NOT have payout
      AND NOT EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'payout'
      )
      -- Does NOT have refund for ALL payers (check if any payer is missing refund)
      AND EXISTS (
        SELECT 1 FROM transactions t_lock
        WHERE t_lock.match_id = m.id AND t_lock.type = 'lock'
          AND NOT EXISTS (
            SELECT 1 FROM transactions t_ref
            WHERE t_ref.match_id = m.id 
              AND t_ref.user_id = t_lock.user_id 
              AND t_ref.type = 'refund'
          )
      )
    ORDER BY m.created_at ASC
    LIMIT 100 -- Safety limit
  LOOP
    SELECT admin_purge_legacy_match(v_match.id, 'cleanup terminal with stuck funds') INTO v_result;
    IF (v_result->>'success')::boolean THEN
      v_processed_ids := array_append(v_processed_ids, v_match.id);
      v_terminal_stuck_count := v_terminal_stuck_count + 1;
      v_total_refunded := v_total_refunded + COALESCE((v_result->>'refunded_total')::numeric, 0);
    END IF;
  END LOOP;

  -- STEP 3: Run auto_refund_expired_matches for standard expired cleanup
  SELECT auto_refund_expired_matches() INTO v_auto_refund_result;

  -- STEP 4: Fix orphan locked balances (locks with no match_id or inconsistent state)
  SELECT admin_fix_orphan_locked_balance() INTO v_orphan_result;

  RETURN jsonb_build_object(
    'success', true,
    'non_terminal_processed', v_non_terminal_count,
    'terminal_stuck_processed', v_terminal_stuck_count,
    'total_matches_processed', v_non_terminal_count + v_terminal_stuck_count,
    'total_refunded', v_total_refunded,
    'processed_match_ids', v_processed_ids[1:10], -- First 10 for display
    'auto_refund_result', v_auto_refund_result,
    'orphan_fix_result', v_orphan_result
  );
END;
$$;

-- ============================================================
-- PHASE 3: Improved admin_fix_orphan_locked_balance
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_fix_orphan_locked_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_sum_locks numeric;
  v_sum_unlocks numeric;
  v_orphan_amount numeric;
  v_fixed_count int := 0;
  v_fixed_total numeric := 0;
BEGIN
  -- Admin check
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Find wallets with locked_balance > 0 but no active matches
  FOR v_wallet IN
    SELECT w.user_id, w.locked_balance, w.balance
    FROM wallets w
    WHERE w.locked_balance > 0
      -- User has NO active matches
      AND NOT EXISTS (
        SELECT 1 FROM match_participants mp
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = w.user_id
        AND m.status NOT IN ('finished', 'expired', 'canceled', 'admin_resolved')
      )
    FOR UPDATE OF w
  LOOP
    -- Calculate: sum of all locks - sum of all (refunds + fees + payouts)
    -- For this user across ALL matches (including those with NULL match_id)
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'lock' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN type IN ('refund', 'fee', 'payout') THEN amount ELSE 0 END), 0)
    INTO v_sum_locks, v_sum_unlocks
    FROM transactions
    WHERE user_id = v_wallet.user_id;

    -- Calculate orphan amount (locks that were never "consumed")
    v_orphan_amount := v_sum_locks - v_sum_unlocks;

    -- Only fix if orphan amount matches locked_balance (sanity check)
    -- OR if locked_balance is positive but orphan calculation is off (use locked_balance)
    IF v_orphan_amount > 0 THEN
      -- Use the smaller of orphan_amount or locked_balance to be conservative
      v_orphan_amount := LEAST(v_orphan_amount, v_wallet.locked_balance);
    ELSIF v_wallet.locked_balance > 0 THEN
      -- locked_balance is positive but ledger says 0 orphan - trust locked_balance
      v_orphan_amount := v_wallet.locked_balance;
    ELSE
      CONTINUE;
    END IF;

    IF v_orphan_amount > 0 THEN
      -- Restore orphan balance
      UPDATE wallets
      SET locked_balance = GREATEST(0, locked_balance - v_orphan_amount),
          balance = balance + v_orphan_amount,
          updated_at = now()
      WHERE user_id = v_wallet.user_id;

      -- Create reconciliation transaction
      INSERT INTO transactions (user_id, type, amount, description, status)
      VALUES (
        v_wallet.user_id, 
        'refund', 
        v_orphan_amount, 
        'Admin fix: orphan locked balance restored',
        'completed'
      );

      v_fixed_count := v_fixed_count + 1;
      v_fixed_total := v_fixed_total + v_orphan_amount;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'fixed_wallets', v_fixed_count,
    'fixed_total', v_fixed_total
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_purge_legacy_match(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_legacy_stuck_matches(int) TO authenticated;-- Fix: Add m.created_at to SELECT DISTINCT for ORDER BY compatibility
CREATE OR REPLACE FUNCTION public.admin_cleanup_legacy_stuck_matches(p_cutoff_minutes integer DEFAULT 35)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_purge_result jsonb;
  v_non_terminal_count int := 0;
  v_terminal_stuck_count int := 0;
  v_total_refunded numeric := 0;
  v_processed_ids uuid[] := ARRAY[]::uuid[];
  v_orphan_result jsonb;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  -- STEP 1: Process non-terminal matches older than cutoff
  -- These are matches stuck in active states that should have completed
  FOR v_match IN
    SELECT DISTINCT m.id, m.status, m.created_at
    FROM matches m
    WHERE m.status IN ('open', 'ready_check', 'in_progress', 'result_pending', 'disputed')
      AND m.created_at < now() - (p_cutoff_minutes || ' minutes')::interval
      -- Has lock transactions (funds were committed)
      AND EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'lock'
      )
      -- No payout yet (not already settled)
      AND NOT EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'payout'
      )
    ORDER BY m.created_at ASC
  LOOP
    -- Purge this legacy match
    v_purge_result := admin_purge_legacy_match(v_match.id, 'legacy cleanup auto-expire (non-terminal)');
    
    IF (v_purge_result->>'success')::boolean THEN
      v_non_terminal_count := v_non_terminal_count + 1;
      v_total_refunded := v_total_refunded + COALESCE((v_purge_result->>'total_refunded')::numeric, 0);
      v_processed_ids := array_append(v_processed_ids, v_match.id);
    END IF;
  END LOOP;

  -- STEP 2: Process terminal matches that have stuck funds
  -- These are matches resolved with old code that didn't unlock properly
  FOR v_match IN
    SELECT DISTINCT m.id, m.status, m.created_at
    FROM matches m
    WHERE m.status IN ('finished', 'expired', 'canceled', 'admin_resolved')
      -- Has lock transactions
      AND EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'lock'
      )
      -- No payout (wasn't settled via winner)
      AND NOT EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'payout'
      )
      -- Check if refunds are missing for some lock transactions
      AND (
        SELECT COUNT(DISTINCT t.user_id) 
        FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'lock'
      ) > (
        SELECT COUNT(DISTINCT t.user_id) 
        FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'refund'
      )
    ORDER BY m.created_at ASC
  LOOP
    -- Purge this legacy match
    v_purge_result := admin_purge_legacy_match(v_match.id, 'legacy cleanup (terminal with stuck funds)');
    
    IF (v_purge_result->>'success')::boolean THEN
      v_terminal_stuck_count := v_terminal_stuck_count + 1;
      v_total_refunded := v_total_refunded + COALESCE((v_purge_result->>'total_refunded')::numeric, 0);
      v_processed_ids := array_append(v_processed_ids, v_match.id);
    END IF;
  END LOOP;

  -- STEP 3: Run standard expired match refunds
  PERFORM auto_refund_expired_matches();

  -- STEP 4: Fix any orphan locked balances (lock transactions with no match_id or mismatched ledger)
  v_orphan_result := admin_fix_orphan_locked_balance();

  RETURN jsonb_build_object(
    'success', true,
    'non_terminal_processed', v_non_terminal_count,
    'terminal_stuck_processed', v_terminal_stuck_count,
    'total_refunded', v_total_refunded,
    'processed_match_ids', v_processed_ids,
    'orphan_fix_result', v_orphan_result,
    'executed_at', now()
  );
END;
$$;-- Fix: Use correct is_admin() helper instead of broken profiles check
CREATE OR REPLACE FUNCTION public.admin_cleanup_legacy_stuck_matches(p_cutoff_minutes integer DEFAULT 35)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_purge_result jsonb;
  v_non_terminal_count int := 0;
  v_terminal_stuck_count int := 0;
  v_total_refunded numeric := 0;
  v_processed_ids uuid[] := ARRAY[]::uuid[];
  v_orphan_result jsonb;
BEGIN
  -- Verify caller is admin using the correct helper function
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- STEP 1: Process non-terminal matches older than cutoff
  -- These are matches stuck in active states that should have completed
  FOR v_match IN
    SELECT DISTINCT m.id, m.status, m.created_at
    FROM matches m
    WHERE m.status IN ('open', 'ready_check', 'in_progress', 'result_pending', 'disputed')
      AND m.created_at < now() - (p_cutoff_minutes || ' minutes')::interval
      -- Has lock transactions (funds were committed)
      AND EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'lock'
      )
      -- No payout yet (not already settled)
      AND NOT EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'payout'
      )
    ORDER BY m.created_at ASC
  LOOP
    -- Purge this legacy match
    v_purge_result := admin_purge_legacy_match(v_match.id, 'legacy cleanup auto-expire (non-terminal)');
    
    IF (v_purge_result->>'success')::boolean THEN
      v_non_terminal_count := v_non_terminal_count + 1;
      v_total_refunded := v_total_refunded + COALESCE((v_purge_result->>'total_refunded')::numeric, 0);
      v_processed_ids := array_append(v_processed_ids, v_match.id);
    END IF;
  END LOOP;

  -- STEP 2: Process terminal matches that have stuck funds
  -- These are matches resolved with old code that didn't unlock properly
  FOR v_match IN
    SELECT DISTINCT m.id, m.status, m.created_at
    FROM matches m
    WHERE m.status IN ('finished', 'expired', 'canceled', 'admin_resolved')
      -- Has lock transactions
      AND EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'lock'
      )
      -- No payout (wasn't settled via winner)
      AND NOT EXISTS (
        SELECT 1 FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'payout'
      )
      -- Check if refunds are missing for some lock transactions
      AND (
        SELECT COUNT(DISTINCT t.user_id) 
        FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'lock'
      ) > (
        SELECT COUNT(DISTINCT t.user_id) 
        FROM transactions t 
        WHERE t.match_id = m.id AND t.type = 'refund'
      )
    ORDER BY m.created_at ASC
  LOOP
    -- Purge this legacy match
    v_purge_result := admin_purge_legacy_match(v_match.id, 'legacy cleanup (terminal with stuck funds)');
    
    IF (v_purge_result->>'success')::boolean THEN
      v_terminal_stuck_count := v_terminal_stuck_count + 1;
      v_total_refunded := v_total_refunded + COALESCE((v_purge_result->>'total_refunded')::numeric, 0);
      v_processed_ids := array_append(v_processed_ids, v_match.id);
    END IF;
  END LOOP;

  -- STEP 3: Run standard expired match refunds
  PERFORM auto_refund_expired_matches();

  -- STEP 4: Fix any orphan locked balances (lock transactions with no match_id or mismatched ledger)
  v_orphan_result := admin_fix_orphan_locked_balance();

  RETURN jsonb_build_object(
    'success', true,
    'non_terminal_processed', v_non_terminal_count,
    'terminal_stuck_processed', v_terminal_stuck_count,
    'total_refunded', v_total_refunded,
    'processed_match_ids', v_processed_ids,
    'orphan_fix_result', v_orphan_result,
    'executed_at', now()
  );
END;
$$;

-- Ensure authenticated users can call the function (admin check is inside)
GRANT EXECUTE ON FUNCTION public.admin_cleanup_legacy_stuck_matches(integer) TO authenticated;-- =============================================================================
-- FIX DEFINITIVO: Legacy Match Cleanup + Wallet Repair
-- Risolve: "record v_lock_tx is not assigned yet" + auth inconsistencies
-- =============================================================================

-- 1. ADMIN_PURGE_LEGACY_MATCH - RISCRITTA con variabili SCALARI (no RECORD problematici)
CREATE OR REPLACE FUNCTION public.admin_purge_legacy_match(p_match_id uuid, p_reason text DEFAULT 'legacy cleanup')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_status text;
  v_match_created_at timestamptz;
  v_payer_id uuid;
  v_payers uuid[];
  v_lock_amount numeric;          -- SCALAR invece di RECORD
  v_refund_exists boolean;
  v_refunded_count int := 0;
  v_refunded_total numeric := 0;
BEGIN
  -- Admin check (SINGLE SOURCE OF TRUTH: user_roles)
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Lock match row and get status (usando variabili scalari)
  SELECT status, created_at INTO v_match_status, v_match_created_at
  FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_not_found');
  END IF;

  -- Skip if already has payout (idempotenza)
  IF EXISTS (SELECT 1 FROM transactions WHERE match_id = p_match_id AND type = 'payout') THEN
    RETURN jsonb_build_object('success', false, 'error', 'match_already_paid_out', 'match_id', p_match_id);
  END IF;

  -- Find all unique payers from lock transactions
  SELECT array_agg(DISTINCT user_id) INTO v_payers
  FROM transactions
  WHERE match_id = p_match_id AND type = 'lock';

  IF v_payers IS NULL OR array_length(v_payers, 1) = 0 THEN
    -- No locks found, just update status if needed
    IF v_match_status NOT IN ('finished', 'expired', 'canceled', 'admin_resolved') THEN
      UPDATE matches SET status = 'expired', finished_at = now() WHERE id = p_match_id;
    END IF;
    RETURN jsonb_build_object('success', true, 'message', 'no_locks_found', 'match_id', p_match_id);
  END IF;

  -- Process each payer (handles 1v1 AND team matches correctly)
  FOREACH v_payer_id IN ARRAY v_payers
  LOOP
    -- Check if already refunded for this match (idempotenza)
    SELECT EXISTS (
      SELECT 1 FROM transactions 
      WHERE match_id = p_match_id AND user_id = v_payer_id AND type = 'refund'
    ) INTO v_refund_exists;

    IF v_refund_exists THEN
      CONTINUE; -- Skip, already refunded
    END IF;

    -- Calculate total lock amount for this user (VARIABILE SCALARE!)
    SELECT COALESCE(SUM(amount), 0) INTO v_lock_amount
    FROM transactions
    WHERE match_id = p_match_id AND user_id = v_payer_id AND type = 'lock';

    IF v_lock_amount <= 0 THEN
      CONTINUE; -- Nothing to refund
    END IF;

    -- Update wallet: restore locked funds to available balance
    UPDATE wallets
    SET locked_balance = GREATEST(0, locked_balance - v_lock_amount),
        balance = balance + v_lock_amount,
        updated_at = now()
    WHERE user_id = v_payer_id;

    -- Create refund transaction (idempotent by design - one per user per match)
    INSERT INTO transactions (user_id, match_id, type, amount, description, status)
    VALUES (v_payer_id, p_match_id, 'refund', v_lock_amount, 'Legacy cleanup: ' || p_reason, 'completed');

    v_refunded_count := v_refunded_count + 1;
    v_refunded_total := v_refunded_total + v_lock_amount;
  END LOOP;

  -- Update match status if not already terminal
  IF v_match_status NOT IN ('finished', 'expired', 'canceled', 'admin_resolved') THEN
    UPDATE matches SET status = 'expired', finished_at = now() WHERE id = p_match_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'match_id', p_match_id,
    'refunded_count', v_refunded_count,
    'total_refunded', v_refunded_total,
    'previous_status', v_match_status
  );
END;
$$;

-- 2. ADMIN_CLEANUP_LEGACY_STUCK_MATCHES - Consolidata e robusta
CREATE OR REPLACE FUNCTION public.admin_cleanup_legacy_stuck_matches(p_cutoff_minutes integer DEFAULT 35)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_id uuid;
  v_match_status text;
  v_purge_result jsonb;
  v_non_terminal_count int := 0;
  v_terminal_stuck_count int := 0;
  v_total_refunded numeric := 0;
  v_processed_ids uuid[] := ARRAY[]::uuid[];
  v_orphan_result jsonb;
BEGIN
  -- Admin check (SINGLE SOURCE OF TRUTH: user_roles via is_admin())
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- STEP 1: Process non-terminal matches older than cutoff
  FOR v_match_id, v_match_status IN
    SELECT m.id, m.status
    FROM matches m
    WHERE m.status IN ('open', 'joined', 'full', 'ready_check', 'in_progress', 'result_pending', 'disputed')
      AND m.created_at < now() - (p_cutoff_minutes || ' minutes')::interval
      AND EXISTS (SELECT 1 FROM transactions t WHERE t.match_id = m.id AND t.type = 'lock')
      AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.match_id = m.id AND t.type = 'payout')
    ORDER BY m.created_at ASC
    LIMIT 100
  LOOP
    v_purge_result := public.admin_purge_legacy_match(v_match_id, 'auto-expire non-terminal');
    IF (v_purge_result->>'success')::boolean THEN
      v_non_terminal_count := v_non_terminal_count + 1;
      v_total_refunded := v_total_refunded + COALESCE((v_purge_result->>'total_refunded')::numeric, 0);
      v_processed_ids := array_append(v_processed_ids, v_match_id);
    END IF;
  END LOOP;

  -- STEP 2: Process terminal matches with stuck funds (lock without refund)
  FOR v_match_id, v_match_status IN
    SELECT m.id, m.status
    FROM matches m
    WHERE m.status IN ('finished', 'expired', 'canceled', 'admin_resolved')
      AND EXISTS (SELECT 1 FROM transactions t WHERE t.match_id = m.id AND t.type = 'lock')
      AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.match_id = m.id AND t.type = 'payout')
      AND EXISTS (
        SELECT 1 FROM transactions t_lock
        WHERE t_lock.match_id = m.id AND t_lock.type = 'lock'
          AND NOT EXISTS (
            SELECT 1 FROM transactions t_ref
            WHERE t_ref.match_id = m.id AND t_ref.user_id = t_lock.user_id AND t_ref.type = 'refund'
          )
      )
    ORDER BY m.created_at ASC
    LIMIT 100
  LOOP
    v_purge_result := public.admin_purge_legacy_match(v_match_id, 'cleanup terminal stuck');
    IF (v_purge_result->>'success')::boolean THEN
      v_terminal_stuck_count := v_terminal_stuck_count + 1;
      v_total_refunded := v_total_refunded + COALESCE((v_purge_result->>'total_refunded')::numeric, 0);
      v_processed_ids := array_append(v_processed_ids, v_match_id);
    END IF;
  END LOOP;

  -- STEP 3: Standard expired refunds
  PERFORM public.auto_refund_expired_matches();

  -- STEP 4: Fix orphan locked balances
  v_orphan_result := public.admin_fix_orphan_locked_balance();

  RETURN jsonb_build_object(
    'success', true,
    'non_terminal_processed', v_non_terminal_count,
    'terminal_stuck_processed', v_terminal_stuck_count,
    'total_matches_processed', v_non_terminal_count + v_terminal_stuck_count,
    'total_refunded', v_total_refunded,
    'processed_match_ids', v_processed_ids[1:10],
    'orphan_fix_result', v_orphan_result,
    'executed_at', now()
  );
END;
$$;

-- 3. ADMIN_FIX_ORPHAN_LOCKED_BALANCE - Migliorata con variabili scalari
CREATE OR REPLACE FUNCTION public.admin_fix_orphan_locked_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_wallet_locked numeric;
  v_wallet_balance numeric;
  v_net_locked numeric;
  v_orphan_amount numeric;
  v_fixed_count int := 0;
  v_fixed_total numeric := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- Find wallets with locked_balance > 0 but no active matches
  FOR v_user_id, v_wallet_locked, v_wallet_balance IN
    SELECT w.user_id, w.locked_balance, w.balance
    FROM wallets w
    WHERE w.locked_balance > 0
      AND NOT EXISTS (
        SELECT 1 FROM match_participants mp
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = w.user_id
        AND m.status NOT IN ('finished', 'expired', 'canceled', 'admin_resolved')
      )
    FOR UPDATE OF w
  LOOP
    -- Calculate net locked from transaction ledger
    SELECT 
      COALESCE(SUM(CASE WHEN type = 'lock' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type IN ('refund', 'fee', 'payout') THEN amount ELSE 0 END), 0)
    INTO v_net_locked
    FROM transactions
    WHERE user_id = v_user_id;

    -- Determine orphan amount
    IF v_net_locked <= 0 AND v_wallet_locked > 0 THEN
      v_orphan_amount := v_wallet_locked;
    ELSIF v_net_locked > 0 AND v_net_locked < v_wallet_locked THEN
      v_orphan_amount := v_wallet_locked - v_net_locked;
    ELSE
      CONTINUE;
    END IF;

    IF v_orphan_amount > 0 THEN
      UPDATE wallets
      SET locked_balance = GREATEST(0, locked_balance - v_orphan_amount),
          balance = balance + v_orphan_amount,
          updated_at = now()
      WHERE user_id = v_user_id;

      INSERT INTO transactions (user_id, type, amount, description, status)
      VALUES (v_user_id, 'refund', v_orphan_amount, 'Admin fix: orphan locked balance restored', 'completed');

      v_fixed_count := v_fixed_count + 1;
      v_fixed_total := v_fixed_total + v_orphan_amount;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'fixed_wallets', v_fixed_count, 'fixed_total', v_fixed_total);
END;
$$;

-- 4. NUOVA: admin_recalculate_wallet_locked_balance - Riconciliazione completa
CREATE OR REPLACE FUNCTION public.admin_recalculate_wallet_locked_balance()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_current_locked numeric;
  v_expected_locked numeric;
  v_diff numeric;
  v_fixed_count int := 0;
  v_fixed_total numeric := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  FOR v_user_id, v_current_locked IN
    SELECT user_id, locked_balance FROM wallets FOR UPDATE
  LOOP
    -- Calculate expected locked from ledger
    SELECT GREATEST(0,
      COALESCE(SUM(CASE WHEN type = 'lock' THEN amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN type IN ('refund', 'fee', 'payout') THEN amount ELSE 0 END), 0)
    ) INTO v_expected_locked
    FROM transactions
    WHERE user_id = v_user_id;

    v_diff := v_current_locked - v_expected_locked;

    IF v_diff <> 0 THEN
      UPDATE wallets
      SET locked_balance = v_expected_locked,
          balance = balance + v_diff,
          updated_at = now()
      WHERE user_id = v_user_id;

      IF v_diff > 0 THEN
        INSERT INTO transactions (user_id, type, amount, description, status)
        VALUES (v_user_id, 'refund', v_diff, 'Admin recalculation: locked balance reconciled', 'completed');
      END IF;

      v_fixed_count := v_fixed_count + 1;
      v_fixed_total := v_fixed_total + ABS(v_diff);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'wallets_reconciled', v_fixed_count, 'total_adjusted', v_fixed_total);
END;
$$;

-- 5. GRANT permissions
GRANT EXECUTE ON FUNCTION public.admin_purge_legacy_match(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_legacy_stuck_matches(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_fix_orphan_locked_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recalculate_wallet_locked_balance() TO authenticated;-- =====================================================
-- AVATAR SHOP SYSTEM - Complete Implementation
-- =====================================================

-- 1. Create avatars catalog table
CREATE TABLE public.avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text NOT NULL,
  price_xp integer NOT NULL DEFAULT 500,
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only ONE avatar can be default
CREATE UNIQUE INDEX idx_avatars_single_default ON public.avatars (is_default) WHERE is_default = true;

-- 2. Create user_avatars ownership table
CREATE TABLE public.user_avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  avatar_id uuid NOT NULL REFERENCES public.avatars(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, avatar_id)
);

-- 3. Add avatar_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_id uuid REFERENCES public.avatars(id);

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;

-- Avatars: everyone can view active avatars
CREATE POLICY "Anyone can view active avatars" 
ON public.avatars FOR SELECT 
USING (is_active = true);

-- User avatars: users can view their own
CREATE POLICY "Users can view own avatars" 
ON public.user_avatars FOR SELECT 
USING (auth.uid() = user_id);

-- =====================================================
-- RPC: PURCHASE AVATAR
-- =====================================================
CREATE OR REPLACE FUNCTION public.purchase_avatar(p_avatar_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_price integer;
  v_current_xp integer;
  v_avatar_name text;
  v_image_url text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get avatar details
  SELECT price_xp, name, image_url INTO v_price, v_avatar_name, v_image_url
  FROM avatars WHERE id = p_avatar_id AND is_active = true;
  
  IF v_price IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'avatar_not_found');
  END IF;

  -- Check if already owned
  IF EXISTS (SELECT 1 FROM user_avatars WHERE user_id = v_user_id AND avatar_id = p_avatar_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_owned');
  END IF;

  -- Get current XP with lock
  SELECT total_xp INTO v_current_xp FROM user_xp WHERE user_id = v_user_id FOR UPDATE;
  v_current_xp := COALESCE(v_current_xp, 0);

  IF v_current_xp < v_price THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'insufficient_xp', 
      'required', v_price, 
      'current', v_current_xp
    );
  END IF;

  -- Deduct XP
  UPDATE user_xp 
  SET total_xp = total_xp - v_price, updated_at = now() 
  WHERE user_id = v_user_id;

  -- Grant avatar ownership
  INSERT INTO user_avatars (user_id, avatar_id) VALUES (v_user_id, p_avatar_id);

  RETURN jsonb_build_object(
    'success', true, 
    'avatar_name', v_avatar_name, 
    'image_url', v_image_url,
    'xp_spent', v_price
  );
END;
$$;

-- =====================================================
-- RPC: EQUIP AVATAR
-- =====================================================
CREATE OR REPLACE FUNCTION public.equip_avatar(p_avatar_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_image_url text;
  v_is_default boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get avatar info
  SELECT image_url, is_default INTO v_image_url, v_is_default
  FROM avatars WHERE id = p_avatar_id AND is_active = true;

  IF v_image_url IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'avatar_not_found');
  END IF;

  -- Verify ownership (default avatar is always allowed)
  IF NOT v_is_default AND NOT EXISTS (
    SELECT 1 FROM user_avatars WHERE user_id = v_user_id AND avatar_id = p_avatar_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_owned');
  END IF;

  -- Update profile
  UPDATE profiles 
  SET avatar_id = p_avatar_id, avatar_url = v_image_url, updated_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('success', true, 'image_url', v_image_url);
END;
$$;

-- =====================================================
-- RPC: GET AVATAR SHOP
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_avatar_shop()
RETURNS TABLE (
  id uuid,
  name text,
  image_url text,
  price_xp integer,
  is_default boolean,
  is_owned boolean,
  is_equipped boolean,
  sort_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_equipped_id uuid;
BEGIN
  -- Get user's currently equipped avatar
  SELECT p.avatar_id INTO v_equipped_id FROM profiles p WHERE p.user_id = v_user_id;

  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.image_url,
    a.price_xp,
    a.is_default,
    (ua.id IS NOT NULL OR a.is_default) AS is_owned,
    (a.id = v_equipped_id) AS is_equipped,
    a.sort_order
  FROM avatars a
  LEFT JOIN user_avatars ua ON ua.avatar_id = a.id AND ua.user_id = v_user_id
  WHERE a.is_active = true
  ORDER BY a.is_default DESC, a.sort_order ASC, a.created_at ASC;
END;
$$;

-- =====================================================
-- TRIGGER: ASSIGN DEFAULT AVATAR TO NEW USERS
-- =====================================================
CREATE OR REPLACE FUNCTION public.assign_default_avatar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_avatar_id uuid;
  v_default_image_url text;
BEGIN
  -- Get default avatar
  SELECT id, image_url INTO v_default_avatar_id, v_default_image_url
  FROM avatars WHERE is_default = true LIMIT 1;

  IF v_default_avatar_id IS NOT NULL THEN
    -- Grant ownership of default avatar
    INSERT INTO user_avatars (user_id, avatar_id)
    VALUES (NEW.user_id, v_default_avatar_id)
    ON CONFLICT DO NOTHING;

    -- Set as active avatar if not already set
    UPDATE profiles 
    SET avatar_id = v_default_avatar_id, avatar_url = v_default_image_url
    WHERE user_id = NEW.user_id AND avatar_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on profiles insert
DROP TRIGGER IF EXISTS trg_assign_default_avatar ON profiles;
CREATE TRIGGER trg_assign_default_avatar
AFTER INSERT ON profiles
FOR EACH ROW
EXECUTE FUNCTION assign_default_avatar();

-- =====================================================
-- SEED AVATARS DATA
-- =====================================================
INSERT INTO public.avatars (name, image_url, price_xp, is_default, sort_order) VALUES
  ('Rookie', '/src/assets/avatars/rookie.png', 0, true, 0),
  ('Dread', '/src/assets/avatars/dread.png', 500, false, 1),
  ('Drip', '/src/assets/avatars/drip.png', 500, false, 2),
  ('Beanie', '/src/assets/avatars/beanie.png', 500, false, 3),
  ('Galaxy', '/src/assets/avatars/galaxy.png', 500, false, 4),
  ('Salute', '/src/assets/avatars/salute.png', 500, false, 5),
  ('Pro Gamer', '/src/assets/avatars/progamer.png', 500, false, 6),
  ('TCL', '/src/assets/avatars/tcl.png', 500, false, 7),
  ('Hype', '/src/assets/avatars/hype.png', 500, false, 8);

-- =====================================================
-- GRANT DEFAULT AVATAR TO EXISTING USERS
-- =====================================================
DO $$
DECLARE
  v_default_avatar_id uuid;
  v_default_image_url text;
BEGIN
  SELECT id, image_url INTO v_default_avatar_id, v_default_image_url
  FROM avatars WHERE is_default = true LIMIT 1;

  IF v_default_avatar_id IS NOT NULL THEN
    -- Grant ownership to all existing users
    INSERT INTO user_avatars (user_id, avatar_id)
    SELECT p.user_id, v_default_avatar_id
    FROM profiles p
    ON CONFLICT DO NOTHING;

    -- Set as active for users without avatar
    UPDATE profiles 
    SET avatar_id = v_default_avatar_id, avatar_url = v_default_image_url
    WHERE avatar_id IS NULL;
  END IF;
END;
$$;-- Update avatar image URLs to use public folder paths for better caching/performance
UPDATE public.avatars SET image_url = '/avatars/rookie.png' WHERE name = 'Rookie';
UPDATE public.avatars SET image_url = '/avatars/dread.png' WHERE name = 'Dread';
UPDATE public.avatars SET image_url = '/avatars/drip.png' WHERE name = 'Drip';
UPDATE public.avatars SET image_url = '/avatars/beanie.png' WHERE name = 'Beanie';
UPDATE public.avatars SET image_url = '/avatars/galaxy.png' WHERE name = 'Galaxy';
UPDATE public.avatars SET image_url = '/avatars/salute.png' WHERE name = 'Salute';
UPDATE public.avatars SET image_url = '/avatars/progamer.png' WHERE name = 'ProGamer';
UPDATE public.avatars SET image_url = '/avatars/tcl.png' WHERE name = 'TCL';
UPDATE public.avatars SET image_url = '/avatars/hype.png' WHERE name = 'Hype';

-- Also update any profiles that have the old avatar URLs
UPDATE public.profiles 
SET avatar_url = '/avatars/' || SUBSTRING(avatar_url FROM '[^/]+$')
WHERE avatar_url LIKE '%/src/assets/avatars/%' OR avatar_url LIKE '/src/assets/avatars/%';

-- Update get_avatar_shop to exclude default avatar from shop listing
CREATE OR REPLACE FUNCTION public.get_avatar_shop()
RETURNS TABLE (
  id uuid,
  name text,
  image_url text,
  price_xp integer,
  is_default boolean,
  is_owned boolean,
  is_equipped boolean,
  sort_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_equipped_avatar_id uuid;
BEGIN
  -- Get current equipped avatar
  SELECT p.avatar_id INTO v_equipped_avatar_id
  FROM profiles p
  WHERE p.id = v_user_id;

  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.image_url,
    a.price_xp,
    a.is_default,
    -- Check if user owns this avatar
    EXISTS (
      SELECT 1 FROM user_avatars ua 
      WHERE ua.user_id = v_user_id AND ua.avatar_id = a.id
    ) OR a.is_default AS is_owned,
    -- Check if this is the equipped avatar
    (a.id = v_equipped_avatar_id) AS is_equipped,
    a.sort_order
  FROM avatars a
  WHERE a.is_active = true
    AND a.is_default = false  -- EXCLUDE default avatar from shop
  ORDER BY a.sort_order ASC;
END;
$$;

-- Create a separate function to get user's owned avatars (including default) for profile section
CREATE OR REPLACE FUNCTION public.get_user_avatars()
RETURNS TABLE (
  id uuid,
  name text,
  image_url text,
  is_default boolean,
  is_equipped boolean,
  sort_order integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_equipped_avatar_id uuid;
BEGIN
  -- Get current equipped avatar
  SELECT p.avatar_id INTO v_equipped_avatar_id
  FROM profiles p
  WHERE p.id = v_user_id;

  RETURN QUERY
  SELECT 
    a.id,
    a.name,
    a.image_url,
    a.is_default,
    (a.id = v_equipped_avatar_id) AS is_equipped,
    a.sort_order
  FROM avatars a
  WHERE a.is_active = true
    AND (
      a.is_default = true  -- Default is always available
      OR EXISTS (
        SELECT 1 FROM user_avatars ua 
        WHERE ua.user_id = v_user_id AND ua.avatar_id = a.id
      )
    )
  ORDER BY a.is_default DESC, a.sort_order ASC;
END;
$$;-- Create atomic wallet balance increment function for thread-safe updates
CREATE OR REPLACE FUNCTION public.increment_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance DECIMAL;
BEGIN
  UPDATE wallets 
  SET balance = balance + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_new_balance;
  
  RETURN v_new_balance;
END;
$$;-- Add Epic OAuth fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS epic_account_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS epic_linked_at TIMESTAMPTZ;

-- Create table for OAuth state validation (anti-CSRF)
CREATE TABLE IF NOT EXISTS public.epic_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  state TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Create index for cleanup of expired states
CREATE INDEX IF NOT EXISTS idx_epic_oauth_states_expires ON public.epic_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_epic_oauth_states_state ON public.epic_oauth_states(state);

-- Enable RLS
ALTER TABLE public.epic_oauth_states ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only manage their own states
CREATE POLICY "Users can insert own oauth states"
  ON public.epic_oauth_states
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own oauth states"
  ON public.epic_oauth_states
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own oauth states"
  ON public.epic_oauth_states
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role policy for edge functions (cleanup, validation)
CREATE POLICY "Service role can manage all oauth states"
  ON public.epic_oauth_states
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Add realtime for epic_oauth_states if needed
ALTER PUBLICATION supabase_realtime ADD TABLE public.epic_oauth_states;-- Add Discord fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_user_id TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS discord_linked_at TIMESTAMPTZ;

-- Index for fast lookup by discord_user_id
CREATE INDEX IF NOT EXISTS idx_profiles_discord_user_id ON public.profiles(discord_user_id) WHERE discord_user_id IS NOT NULL;

-- Create table for Discord OAuth states (anti-CSRF)
CREATE TABLE IF NOT EXISTS public.discord_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  redirect_after TEXT DEFAULT '/',
  is_login BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Enable RLS
ALTER TABLE public.discord_oauth_states ENABLE ROW LEVEL SECURITY;

-- Policy for service role to manage states
CREATE POLICY "Service role can manage discord oauth states"
  ON public.discord_oauth_states
  FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role');

-- Index for cleanup of expired states
CREATE INDEX IF NOT EXISTS idx_discord_oauth_states_expires ON public.discord_oauth_states(expires_at);-- =============================================
-- PULIZIA DATABASE: Elimina tutti gli utenti non-admin
-- Admin: user_id = 'ea30bfbf-780e-47ce-be1b-65e229595dc2'
-- Ordine corretto rispettando tutte le FK
-- =============================================

-- 1. Elimina platform_earnings (referenzia matches)
DELETE FROM platform_earnings;

-- 2. Elimina match_proofs
DELETE FROM match_proofs;

-- 3. Elimina match_chat_messages
DELETE FROM match_chat_messages;

-- 4. Elimina match_participants
DELETE FROM match_participants;

-- 5. Elimina match_results
DELETE FROM match_results;

-- 6. Elimina transactions che referenziano matches
DELETE FROM transactions 
WHERE match_id IS NOT NULL;

-- 7. Elimina TUTTI i matches (l'admin non ne ha creati)
DELETE FROM matches;

-- 8. Elimina team_members
DELETE FROM team_members;

-- 9. Elimina teams
DELETE FROM teams;

-- 10. Elimina notifications
DELETE FROM notifications 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 11. Elimina transactions rimanenti
DELETE FROM transactions 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 12. Elimina user_xp
DELETE FROM user_xp 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 13. Elimina user_challenge_progress
DELETE FROM user_challenge_progress 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 14. Elimina user_avatars
DELETE FROM user_avatars 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 15. Elimina tips
DELETE FROM tips 
WHERE from_user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2'
  AND to_user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 16. Elimina vip_subscriptions
DELETE FROM vip_subscriptions 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 17. Elimina withdrawal_requests
DELETE FROM withdrawal_requests 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 18. Elimina highlights
DELETE FROM highlights 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 19. Elimina chat_messages
DELETE FROM chat_messages 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 20. Elimina wallets
DELETE FROM wallets 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';

-- 21. Elimina profiles (ultimo passo)
DELETE FROM profiles 
WHERE user_id != 'ea30bfbf-780e-47ce-be1b-65e229595dc2';-- Create RPC to set user role (admin only)
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
  p_user_id UUID,
  p_role TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := auth.uid();
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Non autorizzato');
  END IF;

  -- Validate role
  IF p_role NOT IN ('admin', 'user') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ruolo non valido');
  END IF;

  -- Update user_roles (source of truth)
  IF p_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    DELETE FROM public.user_roles 
    WHERE user_id = p_user_id AND role = 'admin'::app_role;
  END IF;

  -- Sync profiles.role for UI compatibility
  UPDATE public.profiles 
  SET role = p_role, updated_at = now()
  WHERE user_id = p_user_id;

  -- Log admin action
  INSERT INTO public.admin_action_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (v_admin_id, 'set_role', 'user', p_user_id, 
    jsonb_build_object('new_role', p_role));

  RETURN jsonb_build_object('success', true, 'role', p_role);
END;
$$;

-- Grant execute to authenticated users (RPC checks is_admin internally)
GRANT EXECUTE ON FUNCTION public.admin_set_user_role(UUID, TEXT) TO authenticated;

-- Fix: Sync crescitaesponenziale's profiles.role with user_roles
UPDATE public.profiles 
SET role = 'admin', updated_at = now()
WHERE user_id = '5778baef-fb11-4191-9683-17cc4c3f2a23';-- Tabella per Stripe Connected Accounts (payout utenti)
CREATE TABLE public.stripe_connected_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    stripe_account_id TEXT NOT NULL UNIQUE,
    onboarding_complete BOOLEAN DEFAULT false,
    charges_enabled BOOLEAN DEFAULT false,
    payouts_enabled BOOLEAN DEFAULT false,
    requirements_due JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stripe_connected_accounts ENABLE ROW LEVEL SECURITY;

-- Users can view own connected account
CREATE POLICY "Users can view own connected account"
ON public.stripe_connected_accounts
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all connected accounts"
ON public.stripe_connected_accounts
FOR SELECT
USING (public.is_admin());

-- Index for fast lookup
CREATE INDEX idx_stripe_connected_accounts_user ON public.stripe_connected_accounts(user_id);
CREATE INDEX idx_stripe_connected_accounts_stripe ON public.stripe_connected_accounts(stripe_account_id);-- Drop and recreate get_leaderboard with correct ordering
DROP FUNCTION IF EXISTS public.get_leaderboard(integer, integer);

-- Fix get_leaderboard ordering: primary by total_earnings DESC, then wins DESC
CREATE FUNCTION public.get_leaderboard(
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  total_matches bigint,
  wins bigint,
  total_earnings numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    lb.id,
    lb.user_id,
    lb.username,
    lb.avatar_url,
    lb.total_matches,
    lb.wins,
    lb.total_earnings
  FROM leaderboard lb
  ORDER BY lb.total_earnings DESC, lb.wins DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- RPC: get_player_rank - Get a single player's global rank
CREATE OR REPLACE FUNCTION public.get_player_rank(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rank FROM (
    SELECT 
      user_id,
      ROW_NUMBER() OVER (ORDER BY total_earnings DESC, wins DESC) AS rank
    FROM leaderboard
    WHERE user_id IS NOT NULL
  ) ranked
  WHERE ranked.user_id = p_user_id;
$$;-- 1. Create search_players_public RPC (missing)
CREATE OR REPLACE FUNCTION public.search_players_public(
  p_query text,
  p_current_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  rank bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pp.user_id,
    pp.username,
    pp.avatar_url,
    COALESCE(
      (SELECT r.rn FROM (
        SELECT lb.user_id, ROW_NUMBER() OVER (ORDER BY lb.total_earnings DESC, lb.wins DESC) as rn
        FROM leaderboard lb
      ) r WHERE r.user_id = pp.user_id),
      999999
    )::bigint as rank
  FROM profiles_public pp
  WHERE 
    pp.username ILIKE '%' || p_query || '%'
    AND (p_current_user_id IS NULL OR pp.user_id != p_current_user_id)
  ORDER BY 
    CASE WHEN LOWER(pp.username) = LOWER(p_query) THEN 0 ELSE 1 END,
    LENGTH(pp.username)
  LIMIT p_limit;
$$;

-- 2. Create get_player_rank RPC (for compare modal)
CREATE OR REPLACE FUNCTION public.get_player_rank(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT r.rn FROM (
      SELECT lb.user_id, ROW_NUMBER() OVER (ORDER BY lb.total_earnings DESC, lb.wins DESC) as rn
      FROM leaderboard lb
    ) r WHERE r.user_id = p_user_id),
    999999
  )::bigint;
$$;

-- 3. Recreate leaderboard view with correct ordering (total_earnings first, then wins)
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard AS
SELECT
  p.id,
  p.user_id,
  p.username,
  p.avatar_url,
  COALESCE(w.wins, 0) as wins,
  COALESCE(tm.total_matches, 0) as total_matches,
  COALESCE(te.total_earnings, 0) as total_earnings
FROM profiles p
LEFT JOIN (
  SELECT mr.winner_user_id as user_id, COUNT(*) as wins
  FROM match_results mr
  WHERE mr.status = 'confirmed' AND mr.winner_user_id IS NOT NULL
  GROUP BY mr.winner_user_id
) w ON w.user_id = p.user_id
LEFT JOIN (
  SELECT mp.user_id, COUNT(DISTINCT mp.match_id) as total_matches
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id AND m.status = 'finished'
  GROUP BY mp.user_id
) tm ON tm.user_id = p.user_id
LEFT JOIN (
  SELECT mr.winner_user_id as user_id, SUM(m.entry_fee * 1.9) as total_earnings
  FROM match_results mr
  JOIN matches m ON m.id = mr.match_id
  WHERE mr.status = 'confirmed' AND mr.winner_user_id IS NOT NULL
  GROUP BY mr.winner_user_id
) te ON te.user_id = p.user_id
ORDER BY total_earnings DESC, wins DESC;

-- 4. Function to generate unique username (for Discord bug fix)
CREATE OR REPLACE FUNCTION public.generate_unique_username(base_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  clean_name text;
  candidate text;
  counter int := 0;
BEGIN
  -- Clean the base name: lowercase, alphanumeric and underscore only
  clean_name := regexp_replace(LOWER(base_name), '[^a-z0-9_]', '', 'g');
  IF LENGTH(clean_name) < 3 THEN
    clean_name := 'player';
  END IF;
  
  candidate := clean_name;
  
  WHILE EXISTS (SELECT 1 FROM profiles WHERE LOWER(username) = LOWER(candidate)) LOOP
    counter := counter + 1;
    candidate := clean_name || counter::text;
  END LOOP;
  
  RETURN candidate;
END;
$$;-- Create match_events table for real-time audio notifications
CREATE TABLE IF NOT EXISTS public.match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'match_created',
    'player_joined',
    'team_ready',
    'all_ready',
    'match_started',
    'result_declared'
  )),
  actor_user_id uuid,
  target_user_ids uuid[] NOT NULL DEFAULT '{}',
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- RLS: Participants and admins can view match events
CREATE POLICY "Participants can view match events" ON public.match_events
  FOR SELECT
  USING (
    auth.uid() = ANY(target_user_ids)
    OR EXISTS (
      SELECT 1 FROM match_participants mp
      WHERE mp.match_id = match_events.match_id
      AND mp.user_id = auth.uid()
    )
    OR is_admin()
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;

-- Create emit_match_event RPC
CREATE OR REPLACE FUNCTION public.emit_match_event(
  p_match_id uuid,
  p_event_type text,
  p_actor_user_id uuid DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_users uuid[];
  v_event_id uuid;
BEGIN
  -- Get all participants of the match as targets (excluding actor)
  SELECT array_agg(mp.user_id)
  INTO v_target_users
  FROM match_participants mp
  WHERE mp.match_id = p_match_id
    AND (p_actor_user_id IS NULL OR mp.user_id != p_actor_user_id);

  -- Insert the event
  INSERT INTO match_events (match_id, event_type, actor_user_id, target_user_ids, payload)
  VALUES (p_match_id, p_event_type, p_actor_user_id, COALESCE(v_target_users, '{}'), p_payload)
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('success', true, 'event_id', v_event_id);
END;
$$;-- =====================================================
-- Fix emit_match_event: Add 5-argument overload
-- =====================================================
-- The set_player_ready function calls emit_match_event with 5 args:
--   emit_match_event(match_id, event_type, actor_user_id, target_user_ids[], payload)
-- But only the 4-arg version exists. This creates the 5-arg overload.

-- Also update the CHECK constraint to allow 'ready' event_type

-- 1. First, drop and recreate the CHECK constraint to allow 'ready' event type
ALTER TABLE public.match_events DROP CONSTRAINT IF EXISTS match_events_event_type_check;

ALTER TABLE public.match_events ADD CONSTRAINT match_events_event_type_check 
  CHECK (event_type IN (
    'match_created',
    'player_joined',
    'team_ready',
    'ready',
    'all_ready',
    'match_started',
    'result_declared'
  ));

-- 2. Create the 5-argument overload for emit_match_event
-- This version accepts explicit target_user_ids array
CREATE OR REPLACE FUNCTION public.emit_match_event(
  p_match_id uuid,
  p_event_type text,
  p_actor_user_id uuid,
  p_target_user_ids uuid[],
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Insert the event with explicit target users
  INSERT INTO match_events (match_id, event_type, actor_user_id, target_user_ids, payload)
  VALUES (p_match_id, p_event_type, p_actor_user_id, COALESCE(p_target_user_ids, '{}'), p_payload)
  RETURNING id INTO v_event_id;

  RETURN jsonb_build_object('success', true, 'event_id', v_event_id);
END;
$$;

-- 3. Update join_match_v2 to emit player_joined event when someone joins
CREATE OR REPLACE FUNCTION public.join_match_v2(
  p_match_id uuid,
  p_team_id uuid DEFAULT NULL,
  p_payment_mode text DEFAULT 'cover'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_match RECORD;
  v_existing_participation RECORD;
  v_team_record RECORD;
  v_team_member RECORD;
  v_team_members uuid[];
  v_accepted_count int;
  v_required_size int;
  v_entry_fee numeric;
  v_total_cost numeric;
  v_per_member_cost numeric;
  v_payer_balance numeric;
  v_member_balance numeric;
  v_member_id uuid;
  v_team_side text;
  v_is_host boolean := false;
  v_team_slots_taken int;
  v_inserted_participant_id uuid;
BEGIN
  -- Validate caller
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'NOT_AUTHENTICATED', 'message', 'Not authenticated');
  END IF;

  -- Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_NOT_FOUND', 'message', 'Match not found');
  END IF;

  -- Must be open
  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_NOT_OPEN', 'message', 'Match is not open for joining');
  END IF;

  -- Check match not expired
  IF v_match.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_EXPIRED', 'message', 'Match has expired');
  END IF;

  v_entry_fee := v_match.entry_fee;
  v_required_size := v_match.team_size;

  -- ====== STRICT BUSY CHECK ======
  -- Block if user is active participant in a non-terminal match (including self)
  SELECT mp.id, m.status, m.id as match_id
  INTO v_existing_participation
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id
  WHERE mp.user_id = v_caller_id
    AND mp.status != 'left'
    AND m.status IN ('open', 'full', 'ready_check', 'in_progress', 'result_pending')
    AND m.expires_at > now()
  LIMIT 1;

  IF v_existing_participation.match_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'ALREADY_IN_MATCH', 'message', 'You are already in an active match');
  END IF;

  -- ====== 1v1 SOLO JOIN ======
  IF v_required_size = 1 THEN
    -- Check not already in this match
    IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = p_match_id AND user_id = v_caller_id AND status != 'left') THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'ALREADY_JOINED', 'message', 'Already joined this match');
    END IF;

    -- Check slot availability
    SELECT COUNT(*) INTO v_team_slots_taken FROM match_participants WHERE match_id = p_match_id AND status != 'left';
    IF v_team_slots_taken >= 2 THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_FULL', 'message', 'Match is full');
    END IF;

    -- Determine team side
    v_team_side := CASE WHEN v_team_slots_taken = 0 THEN 'A' ELSE 'B' END;

    -- Check balance
    SELECT balance INTO v_payer_balance FROM wallets WHERE user_id = v_caller_id FOR UPDATE;
    IF COALESCE(v_payer_balance, 0) < v_entry_fee THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'INSUFFICIENT_BALANCE', 'message', 'Insufficient balance');
    END IF;

    -- Deduct and lock
    UPDATE wallets SET balance = balance - v_entry_fee, locked_balance = locked_balance + v_entry_fee WHERE user_id = v_caller_id;

    -- Record transaction
    INSERT INTO transactions (user_id, type, amount, description, match_id)
    VALUES (v_caller_id, 'match_entry', -v_entry_fee, 'Match entry fee', p_match_id);

    -- Add participant
    INSERT INTO match_participants (match_id, user_id, team_side, status)
    VALUES (p_match_id, v_caller_id, v_team_side, 'joined')
    RETURNING id INTO v_inserted_participant_id;

    -- Update match payer columns
    IF v_team_side = 'A' THEN
      UPDATE matches SET host_payer_user_id = v_caller_id, captain_a_user_id = v_caller_id WHERE id = p_match_id;
    ELSE
      UPDATE matches SET joiner_payer_user_id = v_caller_id, captain_b_user_id = v_caller_id, payment_mode_joiner = 'cover' WHERE id = p_match_id;
    END IF;

    -- Check if match is now full
    SELECT COUNT(*) INTO v_team_slots_taken FROM match_participants WHERE match_id = p_match_id AND status != 'left';
    IF v_team_slots_taken >= 2 THEN
      UPDATE matches SET status = 'ready_check', ready_check_at = now() WHERE id = p_match_id;
    END IF;

    -- Emit player_joined event to notify the match creator
    PERFORM emit_match_event(
      p_match_id,
      'player_joined',
      v_caller_id,
      ARRAY[v_match.creator_id],
      jsonb_build_object('joined_user_id', v_caller_id::text)
    );

    RETURN jsonb_build_object('success', true);
  END IF;

  -- ====== TEAM JOIN ======
  IF p_team_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'TEAM_REQUIRED', 'message', 'Team ID required for team matches');
  END IF;

  -- Validate payment mode
  IF p_payment_mode NOT IN ('cover', 'split') THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'INVALID_PAYMENT_MODE', 'message', 'Invalid payment mode');
  END IF;

  -- Fetch team
  SELECT * INTO v_team_record FROM teams WHERE id = p_team_id;
  IF v_team_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'TEAM_NOT_FOUND', 'message', 'Team not found');
  END IF;

  -- Only owner can join
  IF v_team_record.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'NOT_TEAM_OWNER', 'message', 'Only team owner can join matches');
  END IF;

  -- Get accepted team members
  SELECT array_agg(tm.user_id) INTO v_team_members
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted';

  v_accepted_count := COALESCE(array_length(v_team_members, 1), 0);

  IF v_accepted_count < v_required_size THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'NOT_ENOUGH_MEMBERS', 'message', format('Team needs %s accepted members (has %s)', v_required_size, v_accepted_count));
  END IF;

  -- Take only first N members
  v_team_members := v_team_members[1:v_required_size];

  -- Check no team member is already in a non-terminal match
  FOR v_member_id IN SELECT unnest(v_team_members) LOOP
    SELECT mp.id, m.status
    INTO v_existing_participation
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = v_member_id
      AND mp.status != 'left'
      AND m.status IN ('open', 'full', 'ready_check', 'in_progress', 'result_pending')
      AND m.expires_at > now()
    LIMIT 1;

    IF v_existing_participation.id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'MEMBER_BUSY', 'message', 'One or more team members are already in an active match');
    END IF;
  END LOOP;

  -- Determine team side
  IF v_match.team_a_id IS NULL THEN
    v_team_side := 'A';
    v_is_host := true;
  ELSIF v_match.team_b_id IS NULL THEN
    v_team_side := 'B';
  ELSE
    RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_FULL', 'message', 'Match is full');
  END IF;

  v_total_cost := v_entry_fee * v_required_size;

  -- ====== PAYMENT PROCESSING ======
  IF p_payment_mode = 'cover' THEN
    SELECT balance INTO v_payer_balance FROM wallets WHERE user_id = v_caller_id FOR UPDATE;
    IF COALESCE(v_payer_balance, 0) < v_total_cost THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'INSUFFICIENT_BALANCE', 'message', format('Insufficient balance (need %s coins)', v_total_cost));
    END IF;

    UPDATE wallets SET balance = balance - v_total_cost, locked_balance = locked_balance + v_total_cost WHERE user_id = v_caller_id;
    INSERT INTO transactions (user_id, type, amount, description, match_id)
    VALUES (v_caller_id, 'match_entry', -v_total_cost, 'Team match entry (cover mode)', p_match_id);
  ELSE
    -- Split mode
    FOR v_member_id IN SELECT unnest(v_team_members) LOOP
      SELECT balance INTO v_member_balance FROM wallets WHERE user_id = v_member_id FOR UPDATE;
      IF COALESCE(v_member_balance, 0) < v_entry_fee THEN
        RETURN jsonb_build_object('success', false, 'reason_code', 'MEMBER_INSUFFICIENT_BALANCE', 'message', 'One or more team members have insufficient balance');
      END IF;

      UPDATE wallets SET balance = balance - v_entry_fee, locked_balance = locked_balance + v_entry_fee WHERE user_id = v_member_id;
      INSERT INTO transactions (user_id, type, amount, description, match_id)
      VALUES (v_member_id, 'match_entry', -v_entry_fee, 'Team match entry (split mode)', p_match_id);
    END LOOP;
  END IF;

  -- Add all participants
  FOREACH v_member_id IN ARRAY v_team_members LOOP
    INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
    VALUES (p_match_id, v_member_id, p_team_id, v_team_side, 'joined');
  END LOOP;

  -- Update match with team assignment
  IF v_team_side = 'A' THEN
    UPDATE matches SET
      team_a_id = p_team_id,
      captain_a_user_id = v_caller_id,
      host_payer_user_id = CASE WHEN p_payment_mode = 'cover' THEN v_caller_id ELSE NULL END,
      payment_mode_host = p_payment_mode
    WHERE id = p_match_id;
  ELSE
    UPDATE matches SET
      team_b_id = p_team_id,
      captain_b_user_id = v_caller_id,
      joiner_payer_user_id = CASE WHEN p_payment_mode = 'cover' THEN v_caller_id ELSE NULL END,
      payment_mode_joiner = p_payment_mode
    WHERE id = p_match_id;
  END IF;

  -- Check if match is now full
  IF v_match.team_a_id IS NOT NULL OR v_team_side = 'B' THEN
    UPDATE matches SET status = 'ready_check', ready_check_at = now() WHERE id = p_match_id;
  END IF;

  -- Emit player_joined event to notify the match creator (for team matches)
  IF NOT v_is_host THEN
    PERFORM emit_match_event(
      p_match_id,
      'player_joined',
      v_caller_id,
      ARRAY[v_match.creator_id],
      jsonb_build_object('joined_user_id', v_caller_id::text, 'team_id', p_team_id::text)
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;-- =====================================================
-- Fix join_match_v2 ambiguity: Drop old 1-arg version
-- =====================================================
-- The old join_match_v2(uuid) conflicts with the new
-- join_match_v2(uuid, uuid DEFAULT NULL, text DEFAULT 'cover')
-- because both match a call with just 1 uuid argument.
--
-- Solution: Drop the old version, keep only the new one.

DROP FUNCTION IF EXISTS public.join_match_v2(uuid);-- =====================================================
-- Fix join_match_v2: Use valid transaction type 'lock'
-- instead of invalid 'match_entry'
-- =====================================================
-- The transactions table has a CHECK constraint that only allows:
-- 'deposit', 'lock', 'unlock', 'payout', 'refund', 'fee'
--
-- 'match_entry' is NOT a valid type and causes join to fail with:
-- "new row for relation 'transactions' violates check constraint 'transactions_type_check'"

CREATE OR REPLACE FUNCTION public.join_match_v2(
  p_match_id uuid,
  p_team_id uuid DEFAULT NULL,
  p_payment_mode text DEFAULT 'cover'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_match RECORD;
  v_existing_participation RECORD;
  v_team_record RECORD;
  v_team_member RECORD;
  v_team_members uuid[];
  v_accepted_count int;
  v_required_size int;
  v_entry_fee numeric;
  v_total_cost numeric;
  v_per_member_cost numeric;
  v_payer_balance numeric;
  v_member_balance numeric;
  v_member_id uuid;
  v_team_side text;
  v_is_host boolean := false;
  v_team_slots_taken int;
  v_inserted_participant_id uuid;
BEGIN
  -- Validate caller
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'NOT_AUTHENTICATED', 'message', 'Not authenticated');
  END IF;

  -- Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_NOT_FOUND', 'message', 'Match not found');
  END IF;

  -- Must be open
  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_NOT_OPEN', 'message', 'Match is not open for joining');
  END IF;

  -- Check match not expired
  IF v_match.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_EXPIRED', 'message', 'Match has expired');
  END IF;

  v_entry_fee := v_match.entry_fee;
  v_required_size := v_match.team_size;

  -- ====== STRICT BUSY CHECK ======
  -- Block if user is active participant in a non-terminal match (including self)
  SELECT mp.id, m.status, m.id as match_id
  INTO v_existing_participation
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id
  WHERE mp.user_id = v_caller_id
    AND mp.status != 'left'
    AND m.status IN ('open', 'full', 'ready_check', 'in_progress', 'result_pending')
    AND m.expires_at > now()
  LIMIT 1;

  IF v_existing_participation.match_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'ALREADY_IN_MATCH', 'message', 'You are already in an active match');
  END IF;

  -- ====== 1v1 SOLO JOIN ======
  IF v_required_size = 1 THEN
    -- Check not already in this match
    IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = p_match_id AND user_id = v_caller_id AND status != 'left') THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'ALREADY_JOINED', 'message', 'Already joined this match');
    END IF;

    -- Check slot availability
    SELECT COUNT(*) INTO v_team_slots_taken FROM match_participants WHERE match_id = p_match_id AND status != 'left';
    IF v_team_slots_taken >= 2 THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_FULL', 'message', 'Match is full');
    END IF;

    -- Determine team side
    v_team_side := CASE WHEN v_team_slots_taken = 0 THEN 'A' ELSE 'B' END;

    -- Check balance
    SELECT balance INTO v_payer_balance FROM wallets WHERE user_id = v_caller_id FOR UPDATE;
    IF COALESCE(v_payer_balance, 0) < v_entry_fee THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'INSUFFICIENT_BALANCE', 'message', 'Insufficient balance');
    END IF;

    -- Deduct and lock
    UPDATE wallets SET balance = balance - v_entry_fee, locked_balance = locked_balance + v_entry_fee WHERE user_id = v_caller_id;

    -- Record transaction with correct type 'lock' (not 'match_entry')
    INSERT INTO transactions (user_id, type, amount, description, match_id)
    VALUES (v_caller_id, 'lock', -v_entry_fee, 'Match entry fee', p_match_id);

    -- Add participant
    INSERT INTO match_participants (match_id, user_id, team_side, status)
    VALUES (p_match_id, v_caller_id, v_team_side, 'joined')
    RETURNING id INTO v_inserted_participant_id;

    -- Update match payer columns
    IF v_team_side = 'A' THEN
      UPDATE matches SET host_payer_user_id = v_caller_id, captain_a_user_id = v_caller_id WHERE id = p_match_id;
    ELSE
      UPDATE matches SET joiner_payer_user_id = v_caller_id, captain_b_user_id = v_caller_id, payment_mode_joiner = 'cover' WHERE id = p_match_id;
    END IF;

    -- Check if match is now full
    SELECT COUNT(*) INTO v_team_slots_taken FROM match_participants WHERE match_id = p_match_id AND status != 'left';
    IF v_team_slots_taken >= 2 THEN
      UPDATE matches SET status = 'ready_check', ready_check_at = now() WHERE id = p_match_id;
    END IF;

    -- Emit player_joined event to notify the match creator
    PERFORM emit_match_event(
      p_match_id,
      'player_joined',
      v_caller_id,
      ARRAY[v_match.creator_id],
      jsonb_build_object('joined_user_id', v_caller_id::text)
    );

    RETURN jsonb_build_object('success', true);
  END IF;

  -- ====== TEAM JOIN ======
  IF p_team_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'TEAM_REQUIRED', 'message', 'Team ID required for team matches');
  END IF;

  -- Validate payment mode
  IF p_payment_mode NOT IN ('cover', 'split') THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'INVALID_PAYMENT_MODE', 'message', 'Invalid payment mode');
  END IF;

  -- Fetch team
  SELECT * INTO v_team_record FROM teams WHERE id = p_team_id;
  IF v_team_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'TEAM_NOT_FOUND', 'message', 'Team not found');
  END IF;

  -- Only owner can join
  IF v_team_record.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'NOT_TEAM_OWNER', 'message', 'Only team owner can join matches');
  END IF;

  -- Get accepted team members
  SELECT array_agg(tm.user_id) INTO v_team_members
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted';

  v_accepted_count := COALESCE(array_length(v_team_members, 1), 0);

  IF v_accepted_count < v_required_size THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'NOT_ENOUGH_MEMBERS', 'message', format('Team needs %s accepted members (has %s)', v_required_size, v_accepted_count));
  END IF;

  -- Take only first N members
  v_team_members := v_team_members[1:v_required_size];

  -- Check no team member is already in a non-terminal match
  FOR v_member_id IN SELECT unnest(v_team_members) LOOP
    SELECT mp.id, m.status
    INTO v_existing_participation
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = v_member_id
      AND mp.status != 'left'
      AND m.status IN ('open', 'full', 'ready_check', 'in_progress', 'result_pending')
      AND m.expires_at > now()
    LIMIT 1;

    IF v_existing_participation.id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'MEMBER_BUSY', 'message', 'One or more team members are already in an active match');
    END IF;
  END LOOP;

  -- Determine team side
  IF v_match.team_a_id IS NULL THEN
    v_team_side := 'A';
    v_is_host := true;
  ELSIF v_match.team_b_id IS NULL THEN
    v_team_side := 'B';
  ELSE
    RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_FULL', 'message', 'Match is full');
  END IF;

  v_total_cost := v_entry_fee * v_required_size;

  -- ====== PAYMENT PROCESSING ======
  IF p_payment_mode = 'cover' THEN
    SELECT balance INTO v_payer_balance FROM wallets WHERE user_id = v_caller_id FOR UPDATE;
    IF COALESCE(v_payer_balance, 0) < v_total_cost THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'INSUFFICIENT_BALANCE', 'message', format('Insufficient balance (need %s coins)', v_total_cost));
    END IF;

    UPDATE wallets SET balance = balance - v_total_cost, locked_balance = locked_balance + v_total_cost WHERE user_id = v_caller_id;
    
    -- Use correct type 'lock' (not 'match_entry')
    INSERT INTO transactions (user_id, type, amount, description, match_id)
    VALUES (v_caller_id, 'lock', -v_total_cost, 'Team match entry (cover mode)', p_match_id);
  ELSE
    -- Split mode
    FOR v_member_id IN SELECT unnest(v_team_members) LOOP
      SELECT balance INTO v_member_balance FROM wallets WHERE user_id = v_member_id FOR UPDATE;
      IF COALESCE(v_member_balance, 0) < v_entry_fee THEN
        RETURN jsonb_build_object('success', false, 'reason_code', 'MEMBER_INSUFFICIENT_BALANCE', 'message', 'One or more team members have insufficient balance');
      END IF;

      UPDATE wallets SET balance = balance - v_entry_fee, locked_balance = locked_balance + v_entry_fee WHERE user_id = v_member_id;
      
      -- Use correct type 'lock' (not 'match_entry')
      INSERT INTO transactions (user_id, type, amount, description, match_id)
      VALUES (v_member_id, 'lock', -v_entry_fee, 'Team match entry (split mode)', p_match_id);
    END LOOP;
  END IF;

  -- Add all participants
  FOREACH v_member_id IN ARRAY v_team_members LOOP
    INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
    VALUES (p_match_id, v_member_id, p_team_id, v_team_side, 'joined');
  END LOOP;

  -- Update match with team assignment
  IF v_team_side = 'A' THEN
    UPDATE matches SET
      team_a_id = p_team_id,
      captain_a_user_id = v_caller_id,
      host_payer_user_id = CASE WHEN p_payment_mode = 'cover' THEN v_caller_id ELSE NULL END,
      payment_mode_host = p_payment_mode
    WHERE id = p_match_id;
  ELSE
    UPDATE matches SET
      team_b_id = p_team_id,
      captain_b_user_id = v_caller_id,
      joiner_payer_user_id = CASE WHEN p_payment_mode = 'cover' THEN v_caller_id ELSE NULL END,
      payment_mode_joiner = p_payment_mode
    WHERE id = p_match_id;
  END IF;

  -- Check if match is now full
  IF v_match.team_a_id IS NOT NULL OR v_team_side = 'B' THEN
    UPDATE matches SET status = 'ready_check', ready_check_at = now() WHERE id = p_match_id;
  END IF;

  -- Emit player_joined event to notify the match creator (for team matches)
  IF NOT v_is_host THEN
    PERFORM emit_match_event(
      p_match_id,
      'player_joined',
      v_caller_id,
      ARRAY[v_match.creator_id],
      jsonb_build_object('joined_user_id', v_caller_id::text, 'team_id', p_team_id::text)
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;-- =====================================================
-- Fix submit_team_declaration: Normalize input to UPPERCASE
-- =====================================================
-- The frontend sends 'WIN'/'LOSS' (uppercase) but the old function
-- validated against 'win'/'loss' (lowercase), causing "Invalid result" errors.
-- 
-- Must DROP first because return type changed from json to jsonb.

DROP FUNCTION IF EXISTS public.submit_team_declaration(uuid, text);

CREATE FUNCTION public.submit_team_declaration(
  p_match_id uuid,
  p_result text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_result text;
  v_match matches%ROWTYPE;
  v_participant match_participants%ROWTYPE;
  v_team_side text;
  v_existing_team_result text;
  v_opp_team_side text;
  v_opp_result text;
  v_opp_user_ids uuid[];
  v_finalize jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_authenticated', 'error', 'Not authenticated');
  END IF;

  -- NORMALIZE INPUT: uppercase and trim
  v_result := UPPER(TRIM(p_result));
  
  IF v_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_result', 'error', 'Invalid result. Must be WIN or LOSS');
  END IF;

  -- Lock the match row
  SELECT * INTO v_match
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_found', 'error', 'Match not found');
  END IF;

  -- Check match status
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'status', 'invalid_status', 'error', 'Match is not in progress or result pending');
  END IF;

  -- Get participant record
  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_caller_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'status', 'not_participant', 'error', 'You are not a participant in this match');
  END IF;

  v_team_side := v_participant.team_side;

  -- Check if team already declared (lock-after-first-submit rule)
  SELECT mp.result_choice INTO v_existing_team_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.team_side = v_team_side
    AND mp.result_choice IS NOT NULL
  LIMIT 1;

  IF v_existing_team_result IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'already_submitted',
      'message', 'Your team has already declared: ' || v_existing_team_result
    );
  END IF;

  -- Update ALL participants of this team with the result (team-wide declaration)
  UPDATE match_participants
  SET result_choice = v_result,
      result_at = now()
  WHERE match_id = p_match_id
    AND team_side = v_team_side;

  -- Update match status to result_pending if not already
  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;

  -- Get opponent team side
  v_opp_team_side := CASE WHEN v_team_side = 'A' THEN 'B' ELSE 'A' END;

  -- Get opponent user IDs for event targeting
  SELECT array_agg(user_id) INTO v_opp_user_ids
  FROM match_participants
  WHERE match_id = p_match_id AND team_side = v_opp_team_side;

  -- Emit result_declared event to opponents
  IF v_opp_user_ids IS NOT NULL AND array_length(v_opp_user_ids, 1) > 0 THEN
    PERFORM emit_match_event(
      p_match_id,
      'result_declared',
      v_caller_id,
      v_opp_user_ids,
      jsonb_build_object('team_side', v_team_side, 'result', v_result)
    );
  END IF;

  -- Check if opponent team has also declared
  SELECT mp.result_choice INTO v_opp_result
  FROM match_participants mp
  WHERE mp.match_id = p_match_id
    AND mp.team_side = v_opp_team_side
    AND mp.result_choice IS NOT NULL
  LIMIT 1;

  -- If both teams declared, attempt finalization
  IF v_opp_result IS NOT NULL THEN
    v_finalize := try_finalize_match(p_match_id);
    RETURN jsonb_build_object(
      'success', true,
      'status', COALESCE(v_finalize->>'status', 'submitted'),
      'winner_side', v_finalize->>'winner_side',
      'message', v_finalize->>'message'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'submitted',
    'message', 'Result declared. Waiting for opponent team.'
  );
END;
$$;-- Fix join_match_v2: Use POSITIVE amounts for lock transactions
-- This fixes the disputed match bug where try_finalize_match expects SUM(locks) > 0

CREATE OR REPLACE FUNCTION public.join_match_v2(
  p_match_id uuid,
  p_team_id uuid DEFAULT NULL,
  p_payment_mode text DEFAULT 'cover'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_entry_fee numeric;
  v_wallet wallets%ROWTYPE;
  v_team_side text;
  v_participant_count int;
  v_expected_count int;
  v_total_cost numeric;
  v_member_ids uuid[];
  v_member_id uuid;
  v_member_wallet wallets%ROWTYPE;
  v_joined_count int;
  v_opponent_ids uuid[];
BEGIN
  -- Authentication check
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if user is banned
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = v_caller_id AND is_banned = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account banned');
  END IF;

  -- Lock match row
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Must be open
  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;

  -- Check expiry
  IF v_match.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match has expired');
  END IF;

  v_entry_fee := v_match.entry_fee;

  -- ==================== 1v1 MODE ====================
  IF v_match.team_size = 1 THEN
    -- Cannot join own match
    IF v_match.creator_id = v_caller_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot join your own match');
    END IF;

    -- Check not already participant
    IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = p_match_id AND user_id = v_caller_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already in this match');
    END IF;

    -- Lock wallet
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_caller_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO wallets (user_id, balance, locked_balance) VALUES (v_caller_id, 0, 0)
      RETURNING * INTO v_wallet;
    END IF;

    -- Check balance
    IF v_wallet.balance < v_entry_fee THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'required', v_entry_fee, 'available', v_wallet.balance);
    END IF;

    -- Deduct and lock
    UPDATE wallets SET 
      balance = balance - v_entry_fee,
      locked_balance = locked_balance + v_entry_fee,
      updated_at = now()
    WHERE user_id = v_caller_id;

    -- Record transaction with POSITIVE amount (critical fix!)
    INSERT INTO transactions (user_id, type, amount, description, match_id)
    VALUES (v_caller_id, 'lock', v_entry_fee, 'Match entry fee', p_match_id);

    -- Add participant as team B
    INSERT INTO match_participants (match_id, user_id, team_side, status)
    VALUES (p_match_id, v_caller_id, 'B', 'joined');

    -- Update match status to full and start ready check
    UPDATE matches SET 
      status = 'full',
      ready_check_at = now()
    WHERE id = p_match_id;

    -- Emit event to creator (opponent)
    PERFORM emit_match_event(
      p_match_id,
      'player_joined',
      v_caller_id,
      ARRAY[v_match.creator_id],
      jsonb_build_object('joined_user_id', v_caller_id, 'joined_count', 2, 'max_players', 2, 'team_side', 'B')
    );

    RETURN jsonb_build_object('success', true, 'status', 'joined', 'match_status', 'full');

  -- ==================== TEAM MODE ====================
  ELSE
    -- Must provide team_id
    IF p_team_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Team ID required for team matches');
    END IF;

    -- Verify team exists and caller is owner/captain
    IF NOT EXISTS (
      SELECT 1 FROM teams WHERE id = p_team_id AND owner_id = v_caller_id
    ) AND NOT EXISTS (
      SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = v_caller_id AND role = 'captain' AND status = 'accepted'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Must be team owner or captain to join matches');
    END IF;

    -- Check if team already in match
    IF v_match.team_a_id = p_team_id OR v_match.team_b_id = p_team_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Team already in this match');
    END IF;

    -- team_a_id should be set by creator, we're joining as team_b
    IF v_match.team_a_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Match not properly initialized');
    END IF;

    IF v_match.team_b_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Match already has opponent team');
    END IF;

    v_team_side := 'B';

    -- Get active team members (owner + accepted members) up to team_size
    SELECT array_agg(uid) INTO v_member_ids FROM (
      SELECT owner_id as uid FROM teams WHERE id = p_team_id
      UNION
      SELECT user_id as uid FROM team_members 
      WHERE team_id = p_team_id AND status = 'accepted'
      LIMIT (v_match.team_size - 1)
    ) sub
    LIMIT v_match.team_size;

    IF array_length(v_member_ids, 1) IS NULL OR array_length(v_member_ids, 1) < v_match.team_size THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not enough team members', 'required', v_match.team_size, 'have', COALESCE(array_length(v_member_ids, 1), 0));
    END IF;

    -- Validate payment mode
    IF p_payment_mode NOT IN ('cover', 'split') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid payment mode');
    END IF;

    v_total_cost := v_entry_fee * v_match.team_size;

    -- COVER MODE: captain pays for everyone
    IF p_payment_mode = 'cover' THEN
      SELECT * INTO v_wallet FROM wallets WHERE user_id = v_caller_id FOR UPDATE;
      IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance, locked_balance) VALUES (v_caller_id, 0, 0)
        RETURNING * INTO v_wallet;
      END IF;

      IF v_wallet.balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance for team entry', 'required', v_total_cost, 'available', v_wallet.balance);
      END IF;

      UPDATE wallets SET 
        balance = balance - v_total_cost,
        locked_balance = locked_balance + v_total_cost,
        updated_at = now()
      WHERE user_id = v_caller_id;

      -- Record transaction with POSITIVE amount (critical fix!)
      INSERT INTO transactions (user_id, type, amount, description, match_id)
      VALUES (v_caller_id, 'lock', v_total_cost, 'Team match entry (cover mode)', p_match_id);

    -- SPLIT MODE: each member pays their share
    ELSE
      FOREACH v_member_id IN ARRAY v_member_ids LOOP
        SELECT * INTO v_member_wallet FROM wallets WHERE user_id = v_member_id FOR UPDATE;
        IF NOT FOUND THEN
          INSERT INTO wallets (user_id, balance, locked_balance) VALUES (v_member_id, 0, 0)
          RETURNING * INTO v_member_wallet;
        END IF;

        IF v_member_wallet.balance < v_entry_fee THEN
          RETURN jsonb_build_object('success', false, 'error', 'Team member has insufficient balance', 'member_id', v_member_id);
        END IF;

        UPDATE wallets SET 
          balance = balance - v_entry_fee,
          locked_balance = locked_balance + v_entry_fee,
          updated_at = now()
        WHERE user_id = v_member_id;

        -- Record transaction with POSITIVE amount (critical fix!)
        INSERT INTO transactions (user_id, type, amount, description, match_id)
        VALUES (v_member_id, 'lock', v_entry_fee, 'Team match entry (split mode)', p_match_id);
      END LOOP;
    END IF;

    -- Add all team members as participants
    FOREACH v_member_id IN ARRAY v_member_ids LOOP
      INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
      VALUES (p_match_id, v_member_id, p_team_id, v_team_side, 'joined')
      ON CONFLICT (match_id, user_id) DO NOTHING;
    END LOOP;

    -- Update match
    UPDATE matches SET 
      team_b_id = p_team_id,
      captain_b_user_id = v_caller_id,
      joiner_payer_user_id = v_caller_id,
      payment_mode_joiner = p_payment_mode,
      status = 'full',
      ready_check_at = now()
    WHERE id = p_match_id;

    -- Get opponent team member IDs for event targeting
    SELECT array_agg(user_id) INTO v_opponent_ids
    FROM match_participants
    WHERE match_id = p_match_id AND team_side = 'A';

    -- Count joined players
    SELECT COUNT(*) INTO v_joined_count FROM match_participants WHERE match_id = p_match_id;

    -- Emit event to ALL opponent team members (not just creator)
    IF v_opponent_ids IS NOT NULL AND array_length(v_opponent_ids, 1) > 0 THEN
      PERFORM emit_match_event(
        p_match_id,
        'player_joined',
        v_caller_id,
        v_opponent_ids,
        jsonb_build_object(
          'joined_team_id', p_team_id, 
          'joined_count', v_joined_count, 
          'max_players', v_match.team_size * 2,
          'team_side', v_team_side
        )
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'joined', 'match_status', 'full', 'team_side', v_team_side);
  END IF;
END;
$$;-- Fix join_match_v2: Use 'ready_check' instead of 'full' status
-- This ensures matches are immediately ready for the ready-up phase after joining

CREATE OR REPLACE FUNCTION public.join_match_v2(
  p_match_id uuid,
  p_team_id uuid DEFAULT NULL,
  p_payment_mode text DEFAULT 'cover'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_match matches%ROWTYPE;
  v_entry_fee numeric;
  v_wallet wallets%ROWTYPE;
  v_team_side text;
  v_participant_count int;
  v_expected_count int;
  v_total_cost numeric;
  v_member_ids uuid[];
  v_member_id uuid;
  v_member_wallet wallets%ROWTYPE;
  v_joined_count int;
  v_opponent_ids uuid[];
BEGIN
  -- Authentication check
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if user is banned
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = v_caller_id AND is_banned = true) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account banned');
  END IF;

  -- Lock match row
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Must be open
  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;

  -- Check expiry
  IF v_match.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match has expired');
  END IF;

  v_entry_fee := v_match.entry_fee;

  -- ==================== 1v1 MODE ====================
  IF v_match.team_size = 1 THEN
    -- Cannot join own match
    IF v_match.creator_id = v_caller_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Cannot join your own match');
    END IF;

    -- Check not already participant
    IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = p_match_id AND user_id = v_caller_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Already in this match');
    END IF;

    -- Lock wallet
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_caller_id FOR UPDATE;
    IF NOT FOUND THEN
      INSERT INTO wallets (user_id, balance, locked_balance) VALUES (v_caller_id, 0, 0)
      RETURNING * INTO v_wallet;
    END IF;

    -- Check balance
    IF v_wallet.balance < v_entry_fee THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance', 'required', v_entry_fee, 'available', v_wallet.balance);
    END IF;

    -- Deduct and lock
    UPDATE wallets SET 
      balance = balance - v_entry_fee,
      locked_balance = locked_balance + v_entry_fee,
      updated_at = now()
    WHERE user_id = v_caller_id;

    -- Record transaction with POSITIVE amount (critical fix!)
    INSERT INTO transactions (user_id, type, amount, description, match_id)
    VALUES (v_caller_id, 'lock', v_entry_fee, 'Match entry fee', p_match_id);

    -- Add participant as team B
    INSERT INTO match_participants (match_id, user_id, team_side, status)
    VALUES (p_match_id, v_caller_id, 'B', 'joined');

    -- Update match status to ready_check (FIX: was 'full')
    UPDATE matches SET 
      status = 'ready_check',
      ready_check_at = now()
    WHERE id = p_match_id;

    -- Emit event to creator (opponent)
    PERFORM emit_match_event(
      p_match_id,
      'player_joined',
      v_caller_id,
      ARRAY[v_match.creator_id],
      jsonb_build_object('joined_user_id', v_caller_id, 'joined_count', 2, 'max_players', 2, 'team_side', 'B')
    );

    RETURN jsonb_build_object('success', true, 'status', 'joined', 'match_status', 'ready_check');

  -- ==================== TEAM MODE ====================
  ELSE
    -- Must provide team_id
    IF p_team_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Team ID required for team matches');
    END IF;

    -- Verify team exists and caller is owner/captain
    IF NOT EXISTS (
      SELECT 1 FROM teams WHERE id = p_team_id AND owner_id = v_caller_id
    ) AND NOT EXISTS (
      SELECT 1 FROM team_members WHERE team_id = p_team_id AND user_id = v_caller_id AND role = 'captain' AND status = 'accepted'
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Must be team owner or captain to join matches');
    END IF;

    -- Check if team already in match
    IF v_match.team_a_id = p_team_id OR v_match.team_b_id = p_team_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Team already in this match');
    END IF;

    -- team_a_id should be set by creator, we're joining as team_b
    IF v_match.team_a_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Match not properly initialized');
    END IF;

    IF v_match.team_b_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Match already has opponent team');
    END IF;

    v_team_side := 'B';

    -- Get active team members (owner + accepted members) up to team_size
    SELECT array_agg(uid) INTO v_member_ids FROM (
      SELECT owner_id as uid FROM teams WHERE id = p_team_id
      UNION
      SELECT user_id as uid FROM team_members 
      WHERE team_id = p_team_id AND status = 'accepted'
      LIMIT (v_match.team_size - 1)
    ) sub
    LIMIT v_match.team_size;

    IF array_length(v_member_ids, 1) IS NULL OR array_length(v_member_ids, 1) < v_match.team_size THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not enough team members', 'required', v_match.team_size, 'have', COALESCE(array_length(v_member_ids, 1), 0));
    END IF;

    -- Validate payment mode
    IF p_payment_mode NOT IN ('cover', 'split') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid payment mode');
    END IF;

    v_total_cost := v_entry_fee * v_match.team_size;

    -- COVER MODE: captain pays for everyone
    IF p_payment_mode = 'cover' THEN
      SELECT * INTO v_wallet FROM wallets WHERE user_id = v_caller_id FOR UPDATE;
      IF NOT FOUND THEN
        INSERT INTO wallets (user_id, balance, locked_balance) VALUES (v_caller_id, 0, 0)
        RETURNING * INTO v_wallet;
      END IF;

      IF v_wallet.balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance for team entry', 'required', v_total_cost, 'available', v_wallet.balance);
      END IF;

      UPDATE wallets SET 
        balance = balance - v_total_cost,
        locked_balance = locked_balance + v_total_cost,
        updated_at = now()
      WHERE user_id = v_caller_id;

      -- Record transaction with POSITIVE amount (critical fix!)
      INSERT INTO transactions (user_id, type, amount, description, match_id)
      VALUES (v_caller_id, 'lock', v_total_cost, 'Team match entry (cover mode)', p_match_id);

    -- SPLIT MODE: each member pays their share
    ELSE
      FOREACH v_member_id IN ARRAY v_member_ids LOOP
        SELECT * INTO v_member_wallet FROM wallets WHERE user_id = v_member_id FOR UPDATE;
        IF NOT FOUND THEN
          INSERT INTO wallets (user_id, balance, locked_balance) VALUES (v_member_id, 0, 0)
          RETURNING * INTO v_member_wallet;
        END IF;

        IF v_member_wallet.balance < v_entry_fee THEN
          RETURN jsonb_build_object('success', false, 'error', 'Team member has insufficient balance', 'member_id', v_member_id);
        END IF;

        UPDATE wallets SET 
          balance = balance - v_entry_fee,
          locked_balance = locked_balance + v_entry_fee,
          updated_at = now()
        WHERE user_id = v_member_id;

        -- Record transaction with POSITIVE amount (critical fix!)
        INSERT INTO transactions (user_id, type, amount, description, match_id)
        VALUES (v_member_id, 'lock', v_entry_fee, 'Team match entry (split mode)', p_match_id);
      END LOOP;
    END IF;

    -- Add all team members as participants
    FOREACH v_member_id IN ARRAY v_member_ids LOOP
      INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
      VALUES (p_match_id, v_member_id, p_team_id, v_team_side, 'joined')
      ON CONFLICT (match_id, user_id) DO NOTHING;
    END LOOP;

    -- Update match to ready_check (FIX: was 'full')
    UPDATE matches SET 
      team_b_id = p_team_id,
      captain_b_user_id = v_caller_id,
      joiner_payer_user_id = v_caller_id,
      payment_mode_joiner = p_payment_mode,
      status = 'ready_check',
      ready_check_at = now()
    WHERE id = p_match_id;

    -- Get opponent team member IDs for event targeting
    SELECT array_agg(user_id) INTO v_opponent_ids
    FROM match_participants
    WHERE match_id = p_match_id AND team_side = 'A';

    -- Count joined players
    SELECT COUNT(*) INTO v_joined_count FROM match_participants WHERE match_id = p_match_id;

    -- Emit event to ALL opponent team members (not just creator)
    IF v_opponent_ids IS NOT NULL AND array_length(v_opponent_ids, 1) > 0 THEN
      PERFORM emit_match_event(
        p_match_id,
        'player_joined',
        v_caller_id,
        v_opponent_ids,
        jsonb_build_object(
          'joined_team_id', p_team_id, 
          'joined_count', v_joined_count, 
          'max_players', v_match.team_size * 2,
          'team_side', v_team_side
        )
      );
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'joined', 'match_status', 'ready_check', 'team_side', v_team_side);
  END IF;
END;
$$;

-- Data repair: Unblock existing matches stuck in 'full' status
UPDATE matches
SET status = 'ready_check'
WHERE status = 'full'
  AND started_at IS NULL
  AND expires_at > now();
-- =============================================
-- HIGHLIGHTS VOTING SYSTEM + WEEKLY WINNER
-- =============================================

-- 1. Create highlight_votes table
CREATE TABLE public.highlight_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  highlight_id uuid NOT NULL REFERENCES public.highlights(id) ON DELETE CASCADE,
  week_start date NOT NULL DEFAULT (date_trunc('week', now()))::date,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT highlight_votes_unique_per_week UNIQUE(user_id, week_start)
);

-- 2. Add weekly winner columns to highlights
ALTER TABLE public.highlights 
  ADD COLUMN IF NOT EXISTS is_weekly_winner boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS winner_week date DEFAULT NULL;

-- 3. Enable RLS
ALTER TABLE public.highlight_votes ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
CREATE POLICY "Anyone can view votes"
  ON public.highlight_votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert votes"
  ON public.highlight_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own votes"
  ON public.highlight_votes FOR DELETE
  USING (auth.uid() = user_id);

-- 5. Indexes
CREATE INDEX idx_highlight_votes_highlight ON public.highlight_votes(highlight_id);
CREATE INDEX idx_highlight_votes_week ON public.highlight_votes(week_start);
CREATE INDEX idx_highlight_votes_user_week ON public.highlight_votes(user_id, week_start);

-- 6. RPC: vote_highlight (toggle/switch vote)
CREATE OR REPLACE FUNCTION public.vote_highlight(p_highlight_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_week_start date;
  v_existing_vote record;
  v_action text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  v_week_start := (date_trunc('week', now()))::date;
  
  -- Check if user already voted this week
  SELECT * INTO v_existing_vote
  FROM highlight_votes
  WHERE user_id = v_user_id AND week_start = v_week_start;
  
  IF v_existing_vote IS NOT NULL THEN
    IF v_existing_vote.highlight_id = p_highlight_id THEN
      -- Same highlight: toggle off (unvote)
      DELETE FROM highlight_votes WHERE id = v_existing_vote.id;
      v_action := 'unvoted';
    ELSE
      -- Different highlight: switch vote
      DELETE FROM highlight_votes WHERE id = v_existing_vote.id;
      INSERT INTO highlight_votes (user_id, highlight_id, week_start)
      VALUES (v_user_id, p_highlight_id, v_week_start);
      v_action := 'switched';
    END IF;
  ELSE
    -- No vote yet: insert
    INSERT INTO highlight_votes (user_id, highlight_id, week_start)
    VALUES (v_user_id, p_highlight_id, v_week_start);
    v_action := 'voted';
  END IF;
  
  RETURN json_build_object('success', true, 'action', v_action);
END;
$$;

-- 7. RPC: mark_weekly_winner (admin only)
CREATE OR REPLACE FUNCTION public.mark_weekly_winner(p_highlight_id uuid, p_week date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
  ) INTO v_is_admin;
  
  IF NOT v_is_admin THEN
    RETURN json_build_object('success', false, 'error', 'Admin only');
  END IF;
  
  -- Clear previous winner for this week
  UPDATE highlights SET is_weekly_winner = false, winner_week = NULL
  WHERE winner_week = p_week;
  
  -- Set new winner
  UPDATE highlights SET is_weekly_winner = true, winner_week = p_week
  WHERE id = p_highlight_id;
  
  RETURN json_build_object('success', true);
END;
$$;

-- 8. Enable realtime for votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.highlight_votes;
