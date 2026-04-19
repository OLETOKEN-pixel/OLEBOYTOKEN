-- =============================================================================
-- Fix challenge system: drop old overload, fix record_challenge_event,
-- fix match_created_started to creator-only, correct XP for both users.
--
-- Root causes fixed:
--   1. update_challenge_progress(UUID,TEXT,UUID) old overload still ran
--      because record_challenge_event passed v_source_uuid (uuid) → resolved to
--      old function using daily/weekly period_key instead of 'lifetime'.
--   2. match_created_started fired for ALL participants (creator + joiner).
--   3. Both bugs combined gave owener1 and marv +60 XP each via wrong rows.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PART A: Fix record_challenge_event — pass p_source_id (TEXT) so PostgreSQL
--         resolves to update_challenge_progress(UUID, TEXT, TEXT) — the
--         lifetime version from migration 20260419000000.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_challenge_event(
  p_user_id    uuid,
  p_event_type text,
  p_source_id  text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_hash  text;
  v_source_uuid uuid;
  v_inserted    boolean := false;
BEGIN
  v_event_hash := md5(p_user_id::text || p_event_type || coalesce(p_source_id, ''));

  BEGIN
    v_source_uuid := NULLIF(p_source_id, '')::uuid;
  EXCEPTION WHEN others THEN
    v_source_uuid := NULL;
  END;

  INSERT INTO public.challenge_event_log (user_id, event_type, source_id, event_hash, processed)
  VALUES (p_user_id, p_event_type, v_source_uuid, v_event_hash, false)
  ON CONFLICT (event_hash) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    -- KEY FIX: pass p_source_id as TEXT so PostgreSQL resolves to
    -- update_challenge_progress(UUID, TEXT, TEXT) — the lifetime overload.
    PERFORM public.update_challenge_progress(p_user_id, p_event_type, p_source_id);
  END IF;

  RETURN json_build_object('success', true, 'new_event', v_inserted, 'event_hash', v_event_hash);
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART B: Drop old update_challenge_progress(UUID, TEXT, UUID) overload.
--         Only the lifetime version (UUID, TEXT, TEXT) should remain.
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.update_challenge_progress(uuid, text, uuid);


-- ─────────────────────────────────────────────────────────────────────────────
-- PART C: Fix set_player_ready — fire match_created_started only for creator.
--         Full function reproduced from 20260121134146 with two fixes:
--           1. match_created_started → creator only (not all participants)
--           2. Both record_challenge_event calls use ::text for source_id
-- ─────────────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.set_player_ready(uuid);

CREATE FUNCTION public.set_player_ready(p_match_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_match RECORD;
  v_participant RECORD;
  v_all_ready BOOLEAN;
  v_ready_count INTEGER;
  v_total_count INTEGER;
  v_time_since_ready_check INTERVAL;
  v_is_fast_ready BOOLEAN := false;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = p_match_id;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status NOT IN ('ready_check', 'full') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not in ready check phase');
  END IF;

  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_user_id;

  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not a participant in this match');
  END IF;

  IF v_participant.ready THEN
    SELECT
      COUNT(*) FILTER (WHERE ready = true),
      COUNT(*)
    INTO v_ready_count, v_total_count
    FROM match_participants
    WHERE match_id = p_match_id;

    RETURN jsonb_build_object(
      'success', true,
      'already_ready', true,
      'status', v_match.status,
      'all_ready', (v_ready_count = v_total_count)
    );
  END IF;

  -- Use ready_check_at for timing (when match became full)
  IF v_match.ready_check_at IS NOT NULL THEN
    v_time_since_ready_check := now() - v_match.ready_check_at;
    v_is_fast_ready := v_time_since_ready_check <= interval '2 minutes';
  ELSE
    -- Fallback for old matches
    v_time_since_ready_check := now() - v_participant.joined_at;
    v_is_fast_ready := v_time_since_ready_check <= interval '2 minutes';
  END IF;

  UPDATE match_participants
  SET ready = true, ready_at = now()
  WHERE match_id = p_match_id AND user_id = v_user_id;

  IF v_is_fast_ready THEN
    -- FIX: pass match_id as TEXT (::text) so lifetime overload is called
    PERFORM public.record_challenge_event(v_user_id, 'ready_up_fast', p_match_id::text);
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE ready = true),
    COUNT(*)
  INTO v_ready_count, v_total_count
  FROM match_participants
  WHERE match_id = p_match_id;

  v_all_ready := (v_ready_count = v_total_count);

  IF v_all_ready THEN
    UPDATE matches
    SET status = 'in_progress', started_at = now()
    WHERE id = p_match_id;

    -- FIX: fire match_created_started ONLY for the match creator (not all participants).
    -- "Create Started Matches" challenges track matches YOU created, not matches you joined.
    PERFORM public.record_challenge_event(v_match.creator_id, 'match_created_started', p_match_id::text);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'status', CASE WHEN v_all_ready THEN 'in_progress' ELSE v_match.status END,
    'all_ready', v_all_ready,
    'ready_count', v_ready_count,
    'total_count', v_total_count,
    'fast_ready_recorded', v_is_fast_ready
  );
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART D: Correct XP for affected users.
--
-- Both owener1 (marcopalumbo17@virgilio.it) and marv (ali08fn@gmail.com)
-- jumped from 50 → 110 XP on 2026-04-19 due to the old function bugs.
-- Correct state:
--   owener1: 110 XP (50 base + 40 Create5Started + 20 ReadyUpFast — all legit)
--   marv:     70 XP (50 base + 20 ReadyUpFast — match_created_started was wrong)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_owener1    uuid;
  v_marv       uuid;
  v_ch_create5 uuid;
  v_ch_readyup uuid;
  v_xp_create5 int;
  v_xp_readyup int;
  v_rows       int;
BEGIN
  SELECT id INTO v_owener1 FROM auth.users WHERE email = 'marcopalumbo17@virgilio.it';
  SELECT id INTO v_marv    FROM auth.users WHERE email = 'ali08fn@gmail.com';

  SELECT id, reward_xp INTO v_ch_create5, v_xp_create5
  FROM challenges WHERE metric_type = 'match_created_started' AND is_active = true LIMIT 1;

  SELECT id, reward_xp INTO v_ch_readyup, v_xp_readyup
  FROM challenges WHERE metric_type = 'ready_up_fast' AND is_active = true LIMIT 1;

  -- ── Step 1: Delete incorrect daily/weekly rows created today by old function ──
  DELETE FROM user_challenge_progress
  WHERE user_id IN (v_owener1, v_marv)
    AND period_key IN ('2026-04-19', '2026-W16');

  -- ── Step 2: Subtract the XP those rows incorrectly awarded ──
  -- Both got +20 (ready_up_fast daily) + +40 (create_5_started weekly) = +60 each
  UPDATE user_xp SET total_xp = GREATEST(0, total_xp - 60), updated_at = now()
  WHERE user_id IN (v_owener1, v_marv);

  -- ── Step 3: owener1 legitimately completed "Create 5 Started" ──
  -- Lifetime row was at progress_value=4; the 5th event happened today.
  -- Set it to 5/5 completed+claimed directly (bypasses auto-claim trigger
  -- because trigger only re-awards when NEW.is_claimed=false).
  UPDATE user_challenge_progress
  SET progress_value    = 5,
      is_completed      = true,
      completed_at      = now(),
      is_claimed        = true,
      claimed_at        = now(),
      reward_granted_xp = v_xp_create5
  WHERE user_id      = v_owener1
    AND challenge_id = v_ch_create5
    AND period_key   = 'lifetime'
    AND is_claimed   = false;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    UPDATE user_xp SET total_xp = total_xp + v_xp_create5, updated_at = now()
    WHERE user_id = v_owener1;
  END IF;

  -- ── Step 4: owener1 ready_up_fast lifetime row ──
  INSERT INTO user_challenge_progress
    (user_id, challenge_id, period_key, progress_value,
     is_completed, completed_at, is_claimed, claimed_at, reward_granted_xp)
  VALUES
    (v_owener1, v_ch_readyup, 'lifetime', 1, true, now(), true, now(), v_xp_readyup)
  ON CONFLICT (user_id, challenge_id, period_key) DO UPDATE SET
    progress_value    = 1,
    is_completed      = true,
    is_claimed        = true,
    claimed_at        = now(),
    reward_granted_xp = v_xp_readyup
  WHERE user_challenge_progress.is_claimed = false;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    UPDATE user_xp SET total_xp = total_xp + v_xp_readyup, updated_at = now()
    WHERE user_id = v_owener1;
  END IF;

  -- ── Step 5: marv ready_up_fast lifetime row ──
  INSERT INTO user_challenge_progress
    (user_id, challenge_id, period_key, progress_value,
     is_completed, completed_at, is_claimed, claimed_at, reward_granted_xp)
  VALUES
    (v_marv, v_ch_readyup, 'lifetime', 1, true, now(), true, now(), v_xp_readyup)
  ON CONFLICT (user_id, challenge_id, period_key) DO UPDATE SET
    progress_value    = 1,
    is_completed      = true,
    is_claimed        = true,
    claimed_at        = now(),
    reward_granted_xp = v_xp_readyup
  WHERE user_challenge_progress.is_claimed = false;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows > 0 THEN
    UPDATE user_xp SET total_xp = total_xp + v_xp_readyup, updated_at = now()
    WHERE user_id = v_marv;
  END IF;

END $$;
