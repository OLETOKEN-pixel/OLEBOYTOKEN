-- =====================================================
-- FIX: Add Challenge Event Triggers to Match Functions
-- =====================================================

-- 1. UPDATE complete_match_payout to trigger 'match_completed' for ALL participants
CREATE OR REPLACE FUNCTION public.complete_match_payout(p_match_id uuid, p_winner_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_match RECORD;
    v_entry_fee DECIMAL(10,2);
    v_prize_pool DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
    v_winner_payout DECIMAL(10,2);
    v_loser_user_id UUID;
    v_participant RECORD;
BEGIN
    -- Get match details
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status = 'finished' THEN
        RETURN json_build_object('success', false, 'error', 'Match already finished');
    END IF;
    
    v_entry_fee := v_match.entry_fee;
    v_prize_pool := v_entry_fee * 2;
    v_platform_fee := v_prize_pool * 0.05;
    v_winner_payout := v_prize_pool - v_platform_fee;
    
    -- Find loser (the other participant)
    SELECT user_id INTO v_loser_user_id
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id != p_winner_user_id
    LIMIT 1;
    
    IF v_loser_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Loser not found');
    END IF;
    
    -- Unlock and pay winner (they get their entry back + opponent's entry - fee)
    UPDATE public.wallets
    SET 
        balance = balance + v_winner_payout,
        locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = p_winner_user_id;
    
    -- Remove loser's locked balance (they lose their entry fee)
    UPDATE public.wallets
    SET 
        locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = v_loser_user_id;
    
    -- Log winner payout transaction
    INSERT INTO public.transactions (user_id, type, amount, match_id, description)
    VALUES (p_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Match winnings');
    
    -- Log loser loss transaction
    INSERT INTO public.transactions (user_id, type, amount, match_id, description)
    VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Match entry lost');
    
    -- Record platform fee
    INSERT INTO public.platform_earnings (match_id, amount)
    VALUES (p_match_id, v_platform_fee);
    
    UPDATE public.platform_wallet
    SET balance = balance + v_platform_fee, updated_at = now();
    
    -- Update match status to finished
    UPDATE public.matches
    SET status = 'finished', finished_at = now()
    WHERE id = p_match_id;
    
    -- Update match result status to confirmed
    UPDATE public.match_results
    SET status = 'confirmed', winner_user_id = p_winner_user_id, updated_at = now()
    WHERE match_id = p_match_id;

    -- ========== CHALLENGE EVENTS ==========
    -- Record match_completed for ALL participants (winner and loser)
    FOR v_participant IN 
        SELECT user_id FROM public.match_participants WHERE match_id = p_match_id
    LOOP
        PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
    -- ======================================
    
    RETURN json_build_object(
        'success', true, 
        'winner_payout', v_winner_payout,
        'platform_fee', v_platform_fee
    );
END;
$function$;


-- 2. UPDATE set_player_ready to trigger 'ready_up_fast' and 'match_created_started'
CREATE OR REPLACE FUNCTION public.set_player_ready(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_participant RECORD;
    v_total_participants INT;
    v_ready_count INT;
    v_rows_updated INT;
    v_ready_at TIMESTAMPTZ;
    v_joined_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get match with lock
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status != 'ready_check' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not in ready check phase');
    END IF;
    
    -- Check if participant with lock
    SELECT * INTO v_participant
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id
    FOR UPDATE;
    
    IF v_participant IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not a participant');
    END IF;
    
    IF v_participant.ready = TRUE THEN
        -- Already ready - return current state (idempotent)
        SELECT COUNT(*), COUNT(*) FILTER (WHERE ready = TRUE)
        INTO v_total_participants, v_ready_count
        FROM public.match_participants
        WHERE match_id = p_match_id;
        
        RETURN json_build_object('success', true, 'status', v_match.status, 'ready_count', v_ready_count, 'total', v_total_participants, 'already_ready', true);
    END IF;
    
    -- Set ready timestamp
    v_ready_at := now();
    v_joined_at := v_participant.joined_at;
    
    -- Set ready for this user
    UPDATE public.match_participants
    SET ready = TRUE, ready_at = v_ready_at
    WHERE match_id = p_match_id AND user_id = v_user_id;
    
    -- ========== CHALLENGE: Ready Up Fast ==========
    -- Check if ready within 2 minutes of joining
    IF v_joined_at IS NOT NULL AND (v_ready_at - v_joined_at) <= INTERVAL '2 minutes' THEN
        PERFORM record_challenge_event(v_user_id, 'ready_up_fast', p_match_id);
    END IF;
    -- ==============================================
    
    -- Count all participants and ready ones AFTER the update
    SELECT COUNT(*), COUNT(*) FILTER (WHERE ready = TRUE)
    INTO v_total_participants, v_ready_count
    FROM public.match_participants
    WHERE match_id = p_match_id;
    
    -- Log for debugging
    RAISE LOG 'set_player_ready: match=%, user=%, ready_count=%, total=%', p_match_id, v_user_id, v_ready_count, v_total_participants;
    
    -- Check if ALL participants are ready
    IF v_ready_count >= v_total_participants AND v_total_participants >= 2 THEN
        -- All ready - start match with idempotency guard
        UPDATE public.matches
        SET status = 'in_progress', started_at = now()
        WHERE id = p_match_id AND status = 'ready_check';
        
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        
        IF v_rows_updated > 0 THEN
            RAISE LOG 'set_player_ready: match % transitioned to in_progress', p_match_id;
            
            -- ========== CHALLENGE: Match Created Started ==========
            -- Trigger for the match CREATOR only
            PERFORM record_challenge_event(v_match.creator_id, 'match_created_started', p_match_id);
            -- ======================================================
            
            RETURN json_build_object('success', true, 'status', 'in_progress', 'all_ready', true, 'ready_count', v_ready_count, 'total', v_total_participants);
        ELSE
            -- Already transitioned by concurrent call
            RETURN json_build_object('success', true, 'status', 'in_progress', 'all_ready', true, 'ready_count', v_ready_count, 'total', v_total_participants, 'concurrent', true);
        END IF;
    END IF;
    
    RETURN json_build_object('success', true, 'status', 'ready_check', 'ready_count', v_ready_count, 'total', v_total_participants);
END;
$function$;-- =====================================================
-- FIX 2: Complete Challenge Event Integration
-- =====================================================

-- 1. Update handle_proof_challenge_event to include more statuses
CREATE OR REPLACE FUNCTION public.handle_proof_challenge_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_match RECORD;
BEGIN
  -- Get match info to ensure it's valid
  SELECT * INTO v_match FROM matches WHERE id = NEW.match_id;
  
  -- Count if match exists and has valid status (including admin_resolved and completed)
  IF v_match IS NOT NULL AND v_match.status IN ('in_progress', 'result_pending', 'completed', 'finished', 'admin_resolved', 'disputed', 'started', 'full', 'ready_check') THEN
    PERFORM record_challenge_event(NEW.user_id, 'proof_uploaded', NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Update finalize_team_match to trigger challenge events
CREATE OR REPLACE FUNCTION public.finalize_team_match(p_match_id uuid, p_winner_side text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_match RECORD;
    v_winner_team_id UUID;
    v_loser_team_id UUID;
    v_winner_captain_id UUID;
    v_loser_captain_id UUID;
    v_winner_payment_mode TEXT;
    v_loser_payment_mode TEXT;
    v_entry_fee NUMERIC;
    v_team_size INT;
    v_total_pool NUMERIC;
    v_platform_fee NUMERIC;
    v_prize_pool NUMERIC;
    v_payout_per_member NUMERIC;
    v_participant RECORD;
    v_loser_side TEXT;
BEGIN
    -- Get match info
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    v_entry_fee := v_match.entry_fee;
    v_team_size := v_match.team_size;
    v_loser_side := CASE WHEN p_winner_side = 'A' THEN 'B' ELSE 'A' END;
    
    -- Calculate prize pool: entry_fee * team_size * 2 teams
    v_total_pool := v_entry_fee * v_team_size * 2;
    v_platform_fee := v_total_pool * 0.05;
    v_prize_pool := v_total_pool - v_platform_fee;
    
    -- Determine payment modes and team IDs
    IF p_winner_side = 'A' THEN
        v_winner_team_id := v_match.team_a_id;
        v_loser_team_id := v_match.team_b_id;
        v_winner_payment_mode := COALESCE(v_match.payment_mode_host, 'split');
        v_loser_payment_mode := COALESCE(v_match.payment_mode_joiner, 'split');
    ELSE
        v_winner_team_id := v_match.team_b_id;
        v_loser_team_id := v_match.team_a_id;
        v_winner_payment_mode := COALESCE(v_match.payment_mode_joiner, 'split');
        v_loser_payment_mode := COALESCE(v_match.payment_mode_host, 'split');
    END IF;
    
    -- Get captains
    v_winner_captain_id := (SELECT user_id FROM public.match_participants 
        WHERE match_id = p_match_id AND team_side = p_winner_side 
        ORDER BY joined_at ASC LIMIT 1);
    v_loser_captain_id := (SELECT user_id FROM public.match_participants 
        WHERE match_id = p_match_id AND team_side = v_loser_side 
        ORDER BY joined_at ASC LIMIT 1);
    
    -- ========================================
    -- PROCESS LOSER SIDE (unlock locked funds)
    -- ========================================
    IF v_loser_payment_mode = 'cover' THEN
        UPDATE public.wallets
        SET locked_balance = locked_balance - (v_entry_fee * v_team_size),
            updated_at = now()
        WHERE user_id = v_loser_captain_id AND id IS NOT NULL;
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_loser_captain_id, 'fee', v_entry_fee * v_team_size, p_match_id, 
            'Match perso (Cover All - ' || v_team_size || ' giocatori)', 'completed');
    ELSE
        FOR v_participant IN 
            SELECT user_id FROM public.match_participants 
            WHERE match_id = p_match_id AND team_side = v_loser_side
        LOOP
            UPDATE public.wallets
            SET locked_balance = locked_balance - v_entry_fee,
                updated_at = now()
            WHERE user_id = v_participant.user_id AND id IS NOT NULL;
            
            INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_participant.user_id, 'fee', v_entry_fee, p_match_id, 
                'Match perso (Split Pay)', 'completed');
        END LOOP;
    END IF;
    
    -- ========================================
    -- PROCESS WINNER SIDE (payout winnings)
    -- ========================================
    IF v_winner_payment_mode = 'cover' THEN
        UPDATE public.wallets
        SET balance = balance + v_prize_pool,
            locked_balance = locked_balance - (v_entry_fee * v_team_size),
            updated_at = now()
        WHERE user_id = v_winner_captain_id AND id IS NOT NULL;
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_captain_id, 'payout', v_prize_pool, p_match_id, 
            'Vittoria match (Cover All - Pool: ' || v_total_pool || ' Coins)', 'completed');
    ELSE
        v_payout_per_member := v_prize_pool / v_team_size;
        
        FOR v_participant IN 
            SELECT user_id FROM public.match_participants 
            WHERE match_id = p_match_id AND team_side = p_winner_side
        LOOP
            UPDATE public.wallets
            SET balance = balance + v_payout_per_member,
                locked_balance = locked_balance - v_entry_fee,
                updated_at = now()
            WHERE user_id = v_participant.user_id AND id IS NOT NULL;
            
            INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_participant.user_id, 'payout', v_payout_per_member, p_match_id, 
                'Vittoria match (Split Pay)', 'completed');
        END LOOP;
    END IF;
    
    -- Record platform fee
    INSERT INTO public.platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
    UPDATE public.platform_wallet SET balance = balance + v_platform_fee, updated_at = now();
    
    -- Update match
    UPDATE public.matches 
    SET status = 'finished', finished_at = now() 
    WHERE id = p_match_id;
    
    -- Update result
    UPDATE public.match_results 
    SET status = 'confirmed', winner_team_id = v_winner_team_id, updated_at = now()
    WHERE match_id = p_match_id;

    -- ========== CHALLENGE EVENTS ==========
    -- Record match_completed for ALL participants
    FOR v_participant IN 
        SELECT user_id FROM public.match_participants WHERE match_id = p_match_id
    LOOP
        PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
    -- ======================================
    
    RETURN json_build_object(
        'success', true, 
        'winner_side', p_winner_side,
        'prize_pool', v_prize_pool,
        'platform_fee', v_platform_fee
    );
END;
$$;
-- =====================================================
-- FIX CHALLENGES SYSTEM - COMPLETE OVERHAUL
-- =====================================================

-- 1. Create the MISSING trigger for proof uploads
CREATE OR REPLACE FUNCTION public.handle_proof_challenge_event()
RETURNS TRIGGER AS $$
DECLARE
    v_match RECORD;
BEGIN
    SELECT status INTO v_match FROM public.matches WHERE id = NEW.match_id;
    
    IF v_match.status IS NOT NULL AND v_match.status IN (
        'in_progress', 'result_pending', 'completed', 'finished', 
        'admin_resolved', 'disputed', 'started', 'full', 'ready_check'
    ) THEN
        PERFORM public.record_challenge_event(NEW.user_id, 'proof_uploaded', NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_proof_insert ON public.match_proofs;
CREATE TRIGGER on_proof_insert
    AFTER INSERT ON public.match_proofs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_proof_challenge_event();

-- 2. Drop and recreate submit_match_result with challenge events
DROP FUNCTION IF EXISTS public.submit_match_result(UUID, TEXT);

CREATE FUNCTION public.submit_match_result(p_match_id UUID, p_result TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_participant RECORD;
    v_opponent RECORD;
    v_caller_id UUID;
    v_winner_id UUID;
    v_loser_id UUID;
    v_entry_fee NUMERIC;
    v_prize_pool NUMERIC;
    v_platform_cut NUMERIC;
    v_winner_payout NUMERIC;
    v_all_participant RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match not found');
    END IF;

    IF v_match.status NOT IN ('in_progress', 'started', 'full', 'ready_check', 'result_pending') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Match is not in progress');
    END IF;

    SELECT * INTO v_participant 
    FROM match_participants 
    WHERE match_id = p_match_id AND user_id = v_caller_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not a participant');
    END IF;

    IF v_participant.result_choice IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'You already submitted a result');
    END IF;

    UPDATE match_participants 
    SET result_choice = p_result, result_at = now()
    WHERE id = v_participant.id;

    SELECT * INTO v_opponent 
    FROM match_participants 
    WHERE match_id = p_match_id AND user_id != v_caller_id
    LIMIT 1;

    IF v_opponent.result_choice IS NULL THEN
        UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
        RETURN jsonb_build_object('success', true, 'status', 'pending', 'message', 'Waiting for opponent result');
    END IF;

    v_entry_fee := v_match.entry_fee;
    v_prize_pool := v_entry_fee * 2;
    v_platform_cut := v_prize_pool * 0.10;
    v_winner_payout := v_prize_pool - v_platform_cut;

    IF (p_result = 'WIN' AND v_opponent.result_choice = 'LOSS') THEN
        v_winner_id := v_caller_id;
        v_loser_id := v_opponent.user_id;
    ELSIF (p_result = 'LOSS' AND v_opponent.result_choice = 'WIN') THEN
        v_winner_id := v_opponent.user_id;
        v_loser_id := v_caller_id;
    ELSE
        UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
        
        INSERT INTO match_results (match_id, status, dispute_reason)
        VALUES (p_match_id, 'disputed', 'Both players submitted conflicting results')
        ON CONFLICT (match_id) DO UPDATE SET 
            status = 'disputed',
            dispute_reason = 'Both players submitted conflicting results',
            updated_at = now();
        
        RETURN jsonb_build_object('success', true, 'status', 'disputed', 'message', 'Results conflict - dispute created');
    END IF;

    UPDATE wallets SET 
        locked_balance = COALESCE(locked_balance, 0) - v_entry_fee,
        updated_at = now()
    WHERE user_id IN (v_winner_id, v_loser_id);

    UPDATE wallets SET 
        balance = COALESCE(balance, 0) + v_winner_payout,
        updated_at = now()
    WHERE user_id = v_winner_id;

    INSERT INTO transactions (user_id, type, amount, match_id, description)
    VALUES 
        (v_winner_id, 'unlock', v_entry_fee, p_match_id, 'Entry fee unlocked'),
        (v_loser_id, 'unlock', v_entry_fee, p_match_id, 'Entry fee unlocked'),
        (v_winner_id, 'payout', v_winner_payout, p_match_id, 'Match winnings'),
        (v_loser_id, 'fee', -v_entry_fee, p_match_id, 'Match loss');

    PERFORM record_platform_fee(p_match_id, v_platform_cut);

    UPDATE matches SET 
        status = 'finished',
        finished_at = now()
    WHERE id = p_match_id;

    INSERT INTO match_results (match_id, winner_user_id, status)
    VALUES (p_match_id, v_winner_id, 'confirmed')
    ON CONFLICT (match_id) DO UPDATE SET 
        winner_user_id = v_winner_id,
        status = 'confirmed',
        updated_at = now();

    -- CRITICAL: Register challenge events for ALL participants
    FOR v_all_participant IN 
        SELECT user_id FROM match_participants WHERE match_id = p_match_id
    LOOP
        PERFORM record_challenge_event(v_all_participant.user_id, 'match_completed', p_match_id);
    END LOOP;

    RETURN jsonb_build_object(
        'success', true, 
        'status', 'completed',
        'winner_id', v_winner_id,
        'payout', v_winner_payout
    );
END;
$$;

-- 3. Create admin backfill function
CREATE OR REPLACE FUNCTION public.admin_backfill_challenge_progress(p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_daily_key TEXT;
    v_weekly_key TEXT;
    v_match RECORD;
    v_proof RECORD;
    v_ready RECORD;
    v_count_matches INT := 0;
    v_count_proofs INT := 0;
    v_count_ready INT := 0;
BEGIN
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'error', 'Admin only');
    END IF;

    v_daily_key := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
    v_weekly_key := to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW');
    
    FOR v_match IN 
        SELECT DISTINCT m.id 
        FROM matches m
        JOIN match_participants mp ON mp.match_id = m.id
        WHERE mp.user_id = p_user_id
        AND m.status IN ('finished', 'completed', 'admin_resolved')
        AND m.finished_at IS NOT NULL
        AND DATE(m.finished_at AT TIME ZONE 'UTC') = DATE(now() AT TIME ZONE 'UTC')
    LOOP
        PERFORM record_challenge_event(p_user_id, 'match_completed', v_match.id);
        v_count_matches := v_count_matches + 1;
    END LOOP;
    
    FOR v_proof IN
        SELECT mp.id
        FROM match_proofs mp
        WHERE mp.user_id = p_user_id
        AND DATE(mp.created_at AT TIME ZONE 'UTC') = DATE(now() AT TIME ZONE 'UTC')
    LOOP
        PERFORM record_challenge_event(p_user_id, 'proof_uploaded', v_proof.id);
        v_count_proofs := v_count_proofs + 1;
    END LOOP;
    
    FOR v_ready IN
        SELECT mp.id, mp.match_id
        FROM match_participants mp
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = p_user_id
        AND mp.ready = true
        AND mp.ready_at IS NOT NULL
        AND mp.joined_at IS NOT NULL
        AND (mp.ready_at - mp.joined_at) <= INTERVAL '2 minutes'
        AND DATE(mp.ready_at AT TIME ZONE 'UTC') = DATE(now() AT TIME ZONE 'UTC')
    LOOP
        PERFORM record_challenge_event(p_user_id, 'ready_up_fast', v_ready.match_id);
        v_count_ready := v_count_ready + 1;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'matches_processed', v_count_matches,
        'proofs_processed', v_count_proofs,
        'ready_processed', v_count_ready,
        'daily_key', v_daily_key,
        'weekly_key', v_weekly_key
    );
END;
$$;

-- 4. Ensure realtime is enabled
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_challenge_progress;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.user_xp;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
END $$;

-- =====================================================
-- FIX CRITICAL ISSUES: Storage + Challenges Progress Cap
-- =====================================================

-- 1. Fix storage policy for proofs bucket (more permissive)
DROP POLICY IF EXISTS "Match participants can upload proof files" ON storage.objects;

CREATE POLICY "Match participants can upload proof files"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'proofs'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.match_participants mp
        JOIN public.matches m ON m.id = mp.match_id
        WHERE mp.user_id = auth.uid()
        AND mp.match_id::text = split_part(name, '/', 1)
        AND m.status IN ('in_progress', 'result_pending', 'ready_check', 'full', 'started', 'disputed')
    )
);

-- 2. Fix update_challenge_progress to CAP progress at target_value
CREATE OR REPLACE FUNCTION public.update_challenge_progress(
    p_user_id UUID, 
    p_metric_type TEXT, 
    p_source_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge RECORD;
  v_period_key TEXT;
  v_progress RECORD;
BEGIN
  -- Find all active challenges matching this metric
  FOR v_challenge IN 
    SELECT * FROM challenges 
    WHERE metric_type = p_metric_type 
    AND is_active = true
  LOOP
    -- Get correct period key
    v_period_key := get_current_period_key(v_challenge.type);
    
    -- Upsert progress with CAP at target_value
    INSERT INTO user_challenge_progress (user_id, challenge_id, period_key, progress_value)
    VALUES (p_user_id, v_challenge.id, v_period_key, 1)
    ON CONFLICT (user_id, challenge_id, period_key)
    DO UPDATE SET 
      progress_value = LEAST(user_challenge_progress.progress_value + 1, v_challenge.target_value),
      updated_at = now();
    
    -- Check if now completed
    SELECT * INTO v_progress 
    FROM user_challenge_progress 
    WHERE user_id = p_user_id 
    AND challenge_id = v_challenge.id 
    AND period_key = v_period_key;
    
    IF v_progress.progress_value >= v_challenge.target_value AND NOT COALESCE(v_progress.is_completed, false) THEN
      UPDATE user_challenge_progress 
      SET is_completed = true, completed_at = now()
      WHERE id = v_progress.id;
    END IF;
  END LOOP;
END;
$$;

-- 3. Fix any existing progress that exceeded target (cleanup)
UPDATE user_challenge_progress ucp
SET progress_value = c.target_value
FROM challenges c
WHERE ucp.challenge_id = c.id
AND ucp.progress_value > c.target_value;
-- =====================================================
-- FIX CRITICAL: Drop and recreate functions + Storage Policy
-- =====================================================

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.finalize_team_match(UUID, TEXT);
DROP FUNCTION IF EXISTS public.complete_match_payout(UUID, UUID);
DROP FUNCTION IF EXISTS public.submit_match_result(UUID, TEXT);
DROP FUNCTION IF EXISTS public.submit_team_result(UUID, TEXT);

-- 1. Recreate finalize_team_match with WHERE clause fix
CREATE FUNCTION public.finalize_team_match(p_match_id UUID, p_winner_side TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_winner_team_id UUID;
  v_loser_team_id UUID;
  v_entry_fee NUMERIC;
  v_team_size INT;
  v_total_pot NUMERIC;
  v_platform_fee NUMERIC;
  v_winner_payout NUMERIC;
  v_payout_per_player NUMERIC;
  v_winner_participants UUID[];
  v_loser_participants UUID[];
  v_participant_id UUID;
BEGIN
  -- Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  IF v_match.status NOT IN ('in_progress', 'result_pending', 'disputed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state for finalization');
  END IF;
  
  -- Determine winner/loser teams
  IF p_winner_side = 'A' THEN
    v_winner_team_id := v_match.team_a_id;
    v_loser_team_id := v_match.team_b_id;
  ELSIF p_winner_side = 'B' THEN
    v_winner_team_id := v_match.team_b_id;
    v_loser_team_id := v_match.team_a_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid winner_side');
  END IF;
  
  v_entry_fee := v_match.entry_fee;
  v_team_size := COALESCE(v_match.team_size, 1);
  v_total_pot := v_entry_fee * 2 * v_team_size;
  v_platform_fee := v_total_pot * 0.10;
  v_winner_payout := v_total_pot - v_platform_fee;
  v_payout_per_player := v_winner_payout / v_team_size;
  
  -- Get winner participants
  SELECT ARRAY_AGG(user_id) INTO v_winner_participants
  FROM match_participants
  WHERE match_id = p_match_id AND team_side = p_winner_side;
  
  -- Get loser participants  
  SELECT ARRAY_AGG(user_id) INTO v_loser_participants
  FROM match_participants
  WHERE match_id = p_match_id AND team_side != p_winner_side;
  
  -- Release locked funds and pay winners
  IF v_winner_participants IS NOT NULL THEN
    FOREACH v_participant_id IN ARRAY v_winner_participants
    LOOP
      UPDATE wallets 
      SET locked_balance = locked_balance - v_entry_fee,
          balance = balance + v_payout_per_player,
          updated_at = now()
      WHERE user_id = v_participant_id;
      
      INSERT INTO transactions (user_id, type, amount, match_id, description, status)
      VALUES (v_participant_id, 'match_win', v_payout_per_player, p_match_id, 'Match winnings', 'completed');
      
      PERFORM record_challenge_event(v_participant_id, 'match_completed', p_match_id);
    END LOOP;
  END IF;
  
  -- Release locked funds for losers
  IF v_loser_participants IS NOT NULL THEN
    FOREACH v_participant_id IN ARRAY v_loser_participants
    LOOP
      UPDATE wallets 
      SET locked_balance = locked_balance - v_entry_fee,
          updated_at = now()
      WHERE user_id = v_participant_id;
      
      INSERT INTO transactions (user_id, type, amount, match_id, description, status)
      VALUES (v_participant_id, 'match_loss', -v_entry_fee, p_match_id, 'Match loss', 'completed');
      
      PERFORM record_challenge_event(v_participant_id, 'match_completed', p_match_id);
    END LOOP;
  END IF;
  
  -- Record platform fee - CRITICAL: WHERE clause required
  UPDATE platform_wallet 
  SET balance = balance + v_platform_fee, updated_at = now()
  WHERE id IS NOT NULL;
  
  INSERT INTO platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
  
  -- Update match status
  UPDATE matches 
  SET status = 'finished', finished_at = now()
  WHERE id = p_match_id;
  
  -- Update match result
  INSERT INTO match_results (match_id, winner_team_id, status)
  VALUES (p_match_id, v_winner_team_id, 'confirmed')
  ON CONFLICT (match_id) DO UPDATE SET 
    winner_team_id = v_winner_team_id, 
    status = 'confirmed', 
    updated_at = now();
  
  RETURN jsonb_build_object(
    'success', true, 
    'status', 'completed',
    'message', 'Match finalized successfully',
    'winner_team_id', v_winner_team_id
  );
END;
$$;

-- 2. Recreate complete_match_payout with WHERE clause fix
CREATE FUNCTION public.complete_match_payout(p_match_id UUID, p_winner_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_loser_user_id UUID;
  v_entry_fee NUMERIC;
  v_total_pot NUMERIC;
  v_platform_fee NUMERIC;
  v_winner_payout NUMERIC;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  IF v_match.status NOT IN ('in_progress', 'result_pending', 'disputed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state');
  END IF;
  
  v_entry_fee := v_match.entry_fee;
  v_total_pot := v_entry_fee * 2;
  v_platform_fee := v_total_pot * 0.10;
  v_winner_payout := v_total_pot - v_platform_fee;
  
  SELECT user_id INTO v_loser_user_id
  FROM match_participants
  WHERE match_id = p_match_id AND user_id != p_winner_user_id
  LIMIT 1;
  
  -- Winner: release locked + add winnings
  UPDATE wallets 
  SET locked_balance = locked_balance - v_entry_fee,
      balance = balance + v_winner_payout,
      updated_at = now()
  WHERE user_id = p_winner_user_id;
  
  INSERT INTO transactions (user_id, type, amount, match_id, description, status)
  VALUES (p_winner_user_id, 'match_win', v_winner_payout, p_match_id, 'Match winnings', 'completed');
  
  PERFORM record_challenge_event(p_winner_user_id, 'match_completed', p_match_id);
  
  -- Loser: release locked
  UPDATE wallets 
  SET locked_balance = locked_balance - v_entry_fee,
      updated_at = now()
  WHERE user_id = v_loser_user_id;
  
  INSERT INTO transactions (user_id, type, amount, match_id, description, status)
  VALUES (v_loser_user_id, 'match_loss', -v_entry_fee, p_match_id, 'Match loss', 'completed');
  
  PERFORM record_challenge_event(v_loser_user_id, 'match_completed', p_match_id);
  
  -- Platform fee - CRITICAL: WHERE clause required
  UPDATE platform_wallet 
  SET balance = balance + v_platform_fee, updated_at = now()
  WHERE id IS NOT NULL;
  
  INSERT INTO platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
  
  UPDATE matches 
  SET status = 'finished', finished_at = now()
  WHERE id = p_match_id;
  
  INSERT INTO match_results (match_id, winner_user_id, status)
  VALUES (p_match_id, p_winner_user_id, 'confirmed')
  ON CONFLICT (match_id) DO UPDATE SET 
    winner_user_id = p_winner_user_id, 
    status = 'confirmed', 
    updated_at = now();
  
  RETURN jsonb_build_object(
    'success', true, 
    'status', 'completed',
    'message', 'Payout completed successfully',
    'winner_user_id', p_winner_user_id
  );
END;
$$;

-- 3. Recreate submit_match_result - independent declarations
CREATE FUNCTION public.submit_match_result(p_match_id UUID, p_result TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_caller_id UUID := auth.uid();
  v_participant RECORD;
  v_opponent RECORD;
  v_winner_id UUID;
  v_payout_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF p_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result');
  END IF;
  
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state');
  END IF;
  
  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_caller_id;
  
  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a participant');
  END IF;
  
  IF v_participant.result_choice IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already submitted', 'status', 'already_submitted');
  END IF;
  
  -- Save caller's declaration
  UPDATE match_participants
  SET result_choice = p_result, result_at = now()
  WHERE id = v_participant.id;
  
  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;
  
  SELECT * INTO v_opponent
  FROM match_participants
  WHERE match_id = p_match_id AND user_id != v_caller_id
  LIMIT 1;
  
  IF v_opponent.result_choice IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'pending', 'message', 'Waiting for opponent');
  END IF;
  
  -- Both submitted - check agreement
  IF (p_result = 'WIN' AND v_opponent.result_choice = 'LOSS') OR 
     (p_result = 'LOSS' AND v_opponent.result_choice = 'WIN') THEN
    IF p_result = 'WIN' THEN
      v_winner_id := v_caller_id;
    ELSE
      v_winner_id := v_opponent.user_id;
    END IF;
    
    SELECT complete_match_payout(p_match_id, v_winner_id) INTO v_payout_result;
    
    RETURN jsonb_build_object(
      'success', true, 
      'status', 'completed', 
      'message', 'Match completed',
      'winner_id', v_winner_id
    );
  ELSE
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
    
    INSERT INTO match_results (match_id, status, dispute_reason)
    VALUES (p_match_id, 'disputed', 'Both claimed same result')
    ON CONFLICT (match_id) DO UPDATE SET 
      status = 'disputed', 
      dispute_reason = 'Both claimed same result',
      updated_at = now();
    
    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'message', 'Results conflict - disputed');
  END IF;
END;
$$;

-- 4. Recreate submit_team_result - independent team declarations
CREATE FUNCTION public.submit_team_result(p_match_id UUID, p_result TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_caller_id UUID := auth.uid();
  v_participant RECORD;
  v_caller_side TEXT;
  v_team_a_result TEXT;
  v_team_b_result TEXT;
  v_winner_side TEXT;
  v_payout_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF p_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result');
  END IF;
  
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state');
  END IF;
  
  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_caller_id;
  
  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a participant');
  END IF;
  
  v_caller_side := v_participant.team_side;
  
  IF EXISTS (
    SELECT 1 FROM match_participants 
    WHERE match_id = p_match_id 
    AND team_side = v_caller_side 
    AND result_choice IS NOT NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team already submitted', 'status', 'already_submitted');
  END IF;
  
  -- Save team's declaration
  UPDATE match_participants
  SET result_choice = p_result, result_at = now()
  WHERE match_id = p_match_id AND team_side = v_caller_side;
  
  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;
  
  SELECT result_choice INTO v_team_a_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side = 'A' AND result_choice IS NOT NULL
  LIMIT 1;
  
  SELECT result_choice INTO v_team_b_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side = 'B' AND result_choice IS NOT NULL
  LIMIT 1;
  
  IF v_team_a_result IS NULL OR v_team_b_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'pending', 'message', 'Waiting for other team');
  END IF;
  
  -- Both submitted - check agreement
  IF (v_team_a_result = 'WIN' AND v_team_b_result = 'LOSS') THEN
    v_winner_side := 'A';
  ELSIF (v_team_a_result = 'LOSS' AND v_team_b_result = 'WIN') THEN
    v_winner_side := 'B';
  ELSE
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
    
    INSERT INTO match_results (match_id, status, dispute_reason)
    VALUES (p_match_id, 'disputed', 'Teams claimed same result')
    ON CONFLICT (match_id) DO UPDATE SET 
      status = 'disputed', 
      dispute_reason = 'Teams claimed same result',
      updated_at = now();
    
    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'message', 'Results conflict - disputed');
  END IF;
  
  SELECT finalize_team_match(p_match_id, v_winner_side) INTO v_payout_result;
  
  RETURN jsonb_build_object(
    'success', true, 
    'status', 'completed', 
    'message', 'Match completed',
    'winner_side', v_winner_side
  );
END;
$$;

-- 5. Fix storage RLS policy - include ALL match statuses
DROP POLICY IF EXISTS "Match participants can upload proof files" ON storage.objects;

CREATE POLICY "Match participants can upload proof files"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'proofs'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
        SELECT 1 FROM public.match_participants mp
        JOIN public.matches m ON m.id = mp.match_id
        WHERE mp.user_id = auth.uid()
        AND mp.match_id::text = split_part(name, '/', 1)
        AND m.status IN (
            'open', 'full', 'ready_check', 'in_progress', 'result_pending',
            'started', 'disputed', 'completed', 'finished', 'admin_resolved'
        )
    )
);-- =====================================================
-- FIX CRITICAL: Result Declaration + Proof Upload
-- =====================================================

-- =====================================================
-- 1. CREATE SERVER-SIDE RPC FOR PROOF UPLOAD
-- Uses auth.uid() to avoid client-side user_id mismatch
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_match_proof(
  p_match_id UUID,
  p_image_url TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_is_participant BOOLEAN;
  v_proof_id UUID;
BEGIN
  -- Auth check
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Validate match state
  IF v_match.status NOT IN ('in_progress', 'result_pending', 'ready_check', 'full', 'started', 'disputed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state for proof upload');
  END IF;

  -- Check if caller is participant
  SELECT EXISTS(
    SELECT 1 FROM match_participants 
    WHERE match_id = p_match_id AND user_id = v_caller_id
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a participant in this match');
  END IF;

  -- Insert proof record using auth.uid()
  INSERT INTO match_proofs (match_id, user_id, image_url)
  VALUES (p_match_id, v_caller_id, p_image_url)
  RETURNING id INTO v_proof_id;

  RETURN jsonb_build_object(
    'success', true,
    'proof_id', v_proof_id,
    'message', 'Proof uploaded successfully'
  );
END;
$$;

-- =====================================================
-- 2. FIX complete_match_payout: change transaction types
-- 'match_win' -> 'payout', 'match_loss' -> 'fee'
-- =====================================================
CREATE OR REPLACE FUNCTION public.complete_match_payout(p_match_id UUID, p_winner_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_loser_user_id UUID;
  v_entry_fee NUMERIC;
  v_total_pot NUMERIC;
  v_platform_fee NUMERIC;
  v_winner_payout NUMERIC;
  v_existing_payout BOOLEAN;
BEGIN
  -- Lock match row
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  -- Allow payout from multiple valid states
  IF v_match.status NOT IN ('in_progress', 'result_pending', 'disputed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state');
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
  v_total_pot := v_entry_fee * 2;
  v_platform_fee := v_total_pot * 0.10;
  v_winner_payout := v_total_pot - v_platform_fee;
  
  -- Find loser
  SELECT user_id INTO v_loser_user_id
  FROM match_participants
  WHERE match_id = p_match_id AND user_id != p_winner_user_id
  LIMIT 1;
  
  -- Winner: release locked + add winnings
  UPDATE wallets 
  SET locked_balance = locked_balance - v_entry_fee,
      balance = balance + v_winner_payout,
      updated_at = now()
  WHERE user_id = p_winner_user_id;
  
  -- FIXED: Use 'payout' instead of 'match_win'
  INSERT INTO transactions (user_id, type, amount, match_id, description, status)
  VALUES (p_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Match winnings', 'completed');
  
  PERFORM record_challenge_event(p_winner_user_id, 'match_completed', p_match_id);
  
  -- Loser: release locked
  UPDATE wallets 
  SET locked_balance = locked_balance - v_entry_fee,
      updated_at = now()
  WHERE user_id = v_loser_user_id;
  
  -- FIXED: Use 'fee' instead of 'match_loss' (amount as positive, description explains it's a loss)
  INSERT INTO transactions (user_id, type, amount, match_id, description, status)
  VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Match entry (loss)', 'completed');
  
  PERFORM record_challenge_event(v_loser_user_id, 'match_completed', p_match_id);
  
  -- Platform fee - CRITICAL: WHERE clause required
  UPDATE platform_wallet 
  SET balance = balance + v_platform_fee, updated_at = now()
  WHERE id IS NOT NULL;
  
  INSERT INTO platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
  
  -- Update match status
  UPDATE matches 
  SET status = 'finished', finished_at = now()
  WHERE id = p_match_id;
  
  -- Record result
  INSERT INTO match_results (match_id, winner_user_id, status)
  VALUES (p_match_id, p_winner_user_id, 'confirmed')
  ON CONFLICT (match_id) DO UPDATE SET 
    winner_user_id = p_winner_user_id, 
    status = 'confirmed', 
    updated_at = now();
  
  RETURN jsonb_build_object(
    'success', true, 
    'status', 'completed',
    'message', 'Payout completed successfully',
    'winner_user_id', p_winner_user_id
  );
END;
$$;

-- =====================================================
-- 3. FIX finalize_team_match: change transaction types
-- 'match_win' -> 'payout', 'match_loss' -> 'fee'
-- =====================================================
CREATE OR REPLACE FUNCTION public.finalize_team_match(p_match_id UUID, p_winner_side TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_entry_fee NUMERIC;
  v_team_size INT;
  v_total_pot NUMERIC;
  v_platform_fee NUMERIC;
  v_winner_pot NUMERIC;
  v_payout_per_player NUMERIC;
  v_winner_team_id UUID;
  v_loser_team_id UUID;
  v_winner_participants UUID[];
  v_loser_participants UUID[];
  v_participant_id UUID;
  v_existing_payout BOOLEAN;
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
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state');
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
  v_total_pot := v_entry_fee * v_team_size * 2;
  v_platform_fee := v_total_pot * 0.10;
  v_winner_pot := v_total_pot - v_platform_fee;
  v_payout_per_player := v_winner_pot / v_team_size;

  -- Determine winner/loser teams
  IF p_winner_side = 'A' THEN
    v_winner_team_id := v_match.team_a_id;
    v_loser_team_id := v_match.team_b_id;
  ELSE
    v_winner_team_id := v_match.team_b_id;
    v_loser_team_id := v_match.team_a_id;
  END IF;

  -- Get participant arrays
  SELECT array_agg(user_id) INTO v_winner_participants
  FROM match_participants
  WHERE match_id = p_match_id AND team_side = p_winner_side;

  SELECT array_agg(user_id) INTO v_loser_participants
  FROM match_participants
  WHERE match_id = p_match_id AND team_side != p_winner_side;

  -- Process winners
  IF v_winner_participants IS NOT NULL THEN
    FOREACH v_participant_id IN ARRAY v_winner_participants
    LOOP
      UPDATE wallets 
      SET locked_balance = locked_balance - v_entry_fee,
          balance = balance + v_payout_per_player,
          updated_at = now()
      WHERE user_id = v_participant_id;
      
      -- FIXED: Use 'payout' instead of 'match_win'
      INSERT INTO transactions (user_id, type, amount, match_id, description, status)
      VALUES (v_participant_id, 'payout', v_payout_per_player, p_match_id, 'Match winnings', 'completed');
      
      PERFORM record_challenge_event(v_participant_id, 'match_completed', p_match_id);
    END LOOP;
  END IF;

  -- Process losers
  IF v_loser_participants IS NOT NULL THEN
    FOREACH v_participant_id IN ARRAY v_loser_participants
    LOOP
      UPDATE wallets 
      SET locked_balance = locked_balance - v_entry_fee,
          updated_at = now()
      WHERE user_id = v_participant_id;
      
      -- FIXED: Use 'fee' instead of 'match_loss'
      INSERT INTO transactions (user_id, type, amount, match_id, description, status)
      VALUES (v_participant_id, 'fee', v_entry_fee, p_match_id, 'Match entry (loss)', 'completed');
      
      PERFORM record_challenge_event(v_participant_id, 'match_completed', p_match_id);
    END LOOP;
  END IF;

  -- Platform fee - CRITICAL: WHERE clause required
  UPDATE platform_wallet 
  SET balance = balance + v_platform_fee, updated_at = now()
  WHERE id IS NOT NULL;

  INSERT INTO platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);

  -- Update match status
  UPDATE matches 
  SET status = 'finished', finished_at = now()
  WHERE id = p_match_id;

  -- Record result
  INSERT INTO match_results (match_id, winner_team_id, status)
  VALUES (p_match_id, v_winner_team_id, 'confirmed')
  ON CONFLICT (match_id) DO UPDATE SET 
    winner_team_id = v_winner_team_id,
    status = 'confirmed',
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'message', 'Team match finalized successfully',
    'winner_team_id', v_winner_team_id
  );
END;
$$;

-- =====================================================
-- 4. FIX submit_match_result: ensure independent declarations
-- and proper conflict detection
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_match_result(p_match_id UUID, p_result TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_caller_id UUID := auth.uid();
  v_participant RECORD;
  v_opponent RECORD;
  v_winner_id UUID;
  v_payout_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF p_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result');
  END IF;
  
  -- Lock match row for atomic operation
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  -- Allow submissions only in valid states
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state for result submission');
  END IF;
  
  -- Get caller's participant record
  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_caller_id
  FOR UPDATE;
  
  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a participant');
  END IF;
  
  -- Idempotency: if already submitted, return success without changing
  IF v_participant.result_choice IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 
      'status', 'already_submitted',
      'message', 'You have already submitted your result'
    );
  END IF;
  
  -- Save caller's declaration ONLY
  UPDATE match_participants
  SET result_choice = p_result, result_at = now()
  WHERE id = v_participant.id;
  
  -- Move to result_pending if first submission
  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;
  
  -- Get opponent's record (fresh read to see their choice)
  SELECT * INTO v_opponent
  FROM match_participants
  WHERE match_id = p_match_id AND user_id != v_caller_id
  LIMIT 1;
  
  -- If opponent hasn't submitted yet, return pending
  IF v_opponent.result_choice IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'pending',
      'message', 'Waiting for opponent to submit their result'
    );
  END IF;
  
  -- Both have submitted - check for agreement
  -- Caller says WIN + Opponent says LOSS = Caller wins
  -- Caller says LOSS + Opponent says WIN = Opponent wins
  IF (p_result = 'WIN' AND v_opponent.result_choice = 'LOSS') THEN
    v_winner_id := v_caller_id;
  ELSIF (p_result = 'LOSS' AND v_opponent.result_choice = 'WIN') THEN
    v_winner_id := v_opponent.user_id;
  ELSE
    -- Conflict: both WIN or both LOSS
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
    
    INSERT INTO match_results (match_id, status, dispute_reason)
    VALUES (p_match_id, 'disputed', 
      CASE 
        WHEN p_result = 'WIN' AND v_opponent.result_choice = 'WIN' THEN 'Both players claimed victory'
        ELSE 'Both players claimed defeat'
      END
    )
    ON CONFLICT (match_id) DO UPDATE SET 
      status = 'disputed',
      dispute_reason = EXCLUDED.dispute_reason,
      updated_at = now();
    
    RETURN jsonb_build_object(
      'success', true,
      'status', 'disputed',
      'message', 'Results conflict - match sent to admin for review'
    );
  END IF;
  
  -- Agreement reached - process payout
  v_payout_result := complete_match_payout(p_match_id, v_winner_id);
  
  IF (v_payout_result->>'success')::boolean THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'completed',
      'message', 'Match completed successfully',
      'winner_id', v_winner_id
    );
  ELSE
    RETURN v_payout_result;
  END IF;
END;
$$;

-- =====================================================
-- 5. FIX submit_team_result: ensure independent team declarations
-- =====================================================
CREATE OR REPLACE FUNCTION public.submit_team_result(p_match_id UUID, p_result TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_caller_id UUID := auth.uid();
  v_participant RECORD;
  v_caller_side TEXT;
  v_team_a_result TEXT;
  v_team_b_result TEXT;
  v_winner_side TEXT;
  v_finalize_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF p_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result');
  END IF;
  
  -- Lock match row
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state');
  END IF;
  
  -- Get caller's participant and side
  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_caller_id
  FOR UPDATE;
  
  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not a participant');
  END IF;
  
  v_caller_side := v_participant.team_side;
  
  -- Check if caller's team already submitted
  IF EXISTS(
    SELECT 1 FROM match_participants 
    WHERE match_id = p_match_id 
      AND team_side = v_caller_side 
      AND result_choice IS NOT NULL
  ) THEN
    RETURN jsonb_build_object(
      'success', true, 
      'status', 'already_submitted',
      'message', 'Your team has already submitted a result'
    );
  END IF;
  
  -- Update all team members with the result (team-wide declaration)
  UPDATE match_participants
  SET result_choice = p_result, result_at = now()
  WHERE match_id = p_match_id AND team_side = v_caller_side;
  
  -- Move to result_pending if first submission
  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;
  
  -- Get team results
  SELECT result_choice INTO v_team_a_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side = 'A' AND result_choice IS NOT NULL
  LIMIT 1;
  
  SELECT result_choice INTO v_team_b_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side = 'B' AND result_choice IS NOT NULL
  LIMIT 1;
  
  -- If other team hasn't submitted, return pending
  IF v_team_a_result IS NULL OR v_team_b_result IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'pending',
      'message', 'Waiting for opponent team to submit their result'
    );
  END IF;
  
  -- Both teams submitted - check for agreement
  IF (v_team_a_result = 'WIN' AND v_team_b_result = 'LOSS') THEN
    v_winner_side := 'A';
  ELSIF (v_team_a_result = 'LOSS' AND v_team_b_result = 'WIN') THEN
    v_winner_side := 'B';
  ELSE
    -- Conflict
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
    
    INSERT INTO match_results (match_id, status, dispute_reason)
    VALUES (p_match_id, 'disputed',
      CASE 
        WHEN v_team_a_result = 'WIN' AND v_team_b_result = 'WIN' THEN 'Both teams claimed victory'
        ELSE 'Both teams claimed defeat'
      END
    )
    ON CONFLICT (match_id) DO UPDATE SET 
      status = 'disputed',
      dispute_reason = EXCLUDED.dispute_reason,
      updated_at = now();
    
    RETURN jsonb_build_object(
      'success', true,
      'status', 'disputed',
      'message', 'Results conflict - match sent to admin for review'
    );
  END IF;
  
  -- Agreement - finalize team match
  v_finalize_result := finalize_team_match(p_match_id, v_winner_side);
  
  IF (v_finalize_result->>'success')::boolean THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'completed',
      'message', 'Match completed successfully',
      'winner', v_winner_side
    );
  ELSE
    RETURN v_finalize_result;
  END IF;
END;
$$;-- =====================================================
-- FIX: Remove duplicate triggers on match_proofs
-- ROOT CAUSE: Two triggers (on_proof_insert, on_proof_insert_challenge) 
-- both call handle_proof_challenge_event, causing duplicate event_hash 
-- constraint violation and rolling back the entire proof insert
-- =====================================================

-- Step 1: Drop ALL existing triggers on match_proofs to start clean
DROP TRIGGER IF EXISTS on_proof_insert ON public.match_proofs;
DROP TRIGGER IF EXISTS on_proof_insert_challenge ON public.match_proofs;
DROP TRIGGER IF EXISTS trigger_proof_challenge ON public.match_proofs;

-- Step 2: Make record_challenge_event "race-safe" using ON CONFLICT DO NOTHING
-- This ensures that even if called multiple times, it won't crash
CREATE OR REPLACE FUNCTION public.record_challenge_event(
  p_user_id uuid,
  p_event_type text,
  p_source_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_hash text;
  v_challenge_id uuid;
  v_inserted boolean := false;
BEGIN
  -- Generate unique event hash
  v_event_hash := md5(p_user_id::text || p_event_type || p_source_id);
  
  -- Try to insert the event - ON CONFLICT means duplicate = no-op (idempotent)
  INSERT INTO public.challenge_event_log (
    user_id,
    event_type,
    source_id,
    event_hash,
    processed
  )
  VALUES (
    p_user_id,
    p_event_type,
    p_source_id,
    v_event_hash,
    false
  )
  ON CONFLICT (event_hash) DO NOTHING;
  
  -- Check if we actually inserted (GET DIAGNOSTICS would work too)
  -- If row was inserted, ROW_COUNT = 1; if conflict, ROW_COUNT = 0
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  
  -- Only update challenge progress if this is a NEW event
  IF v_inserted THEN
    PERFORM public.update_challenge_progress(p_user_id, p_event_type, p_source_id);
  END IF;
  
  RETURN json_build_object(
    'success', true,
    'new_event', v_inserted,
    'event_hash', v_event_hash
  );
END;
$$;

-- Step 3: Recreate SINGLE canonical trigger for challenge events on proof insert
CREATE OR REPLACE FUNCTION public.handle_proof_challenge_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Record the proof_uploaded event for challenge tracking
  PERFORM public.record_challenge_event(
    NEW.user_id,
    'proof_uploaded',
    NEW.id::text
  );
  RETURN NEW;
END;
$$;

-- Create exactly ONE trigger
CREATE TRIGGER on_proof_insert
  AFTER INSERT ON public.match_proofs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_proof_challenge_event();

-- Step 4: Expand storage policy to allow uploads in ALL active match states
-- First drop any existing restrictive policies
DROP POLICY IF EXISTS "Match participants can upload proof files" ON storage.objects;

-- Recreate with expanded state list
CREATE POLICY "Match participants can upload proof files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'proofs'
  AND EXISTS (
    SELECT 1 FROM public.match_participants mp
    JOIN public.matches m ON m.id = mp.match_id
    WHERE mp.user_id = auth.uid()
    AND mp.match_id = (storage.foldername(name))[1]::uuid
    AND m.status IN (
      'open', 'joined', 'ready_check', 'full', 'started', 
      'in_progress', 'result_pending', 'disputed', 
      'completed', 'finished', 'admin_resolved'
    )
  )
);-- Fix record_challenge_event: challenge_event_log.source_id is uuid, but RPC receives text.
-- Make it safe by casting text->uuid with exception handling.

CREATE OR REPLACE FUNCTION public.record_challenge_event(
  p_user_id uuid,
  p_event_type text,
  p_source_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_hash text;
  v_source_uuid uuid;
  v_inserted boolean := false;
BEGIN
  v_event_hash := md5(p_user_id::text || p_event_type || coalesce(p_source_id, ''));

  -- Safe cast: some events may pass non-uuid source ids
  BEGIN
    v_source_uuid := NULLIF(p_source_id, '')::uuid;
  EXCEPTION WHEN others THEN
    v_source_uuid := NULL;
  END;

  INSERT INTO public.challenge_event_log (
    user_id,
    event_type,
    source_id,
    event_hash,
    processed
  )
  VALUES (
    p_user_id,
    p_event_type,
    v_source_uuid,
    v_event_hash,
    false
  )
  ON CONFLICT (event_hash) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    PERFORM public.update_challenge_progress(p_user_id, p_event_type, p_source_id);
  END IF;

  RETURN json_build_object(
    'success', true,
    'new_event', v_inserted,
    'event_hash', v_event_hash
  );
END;
$$;
-- Fix record_challenge_event: pass v_source_uuid (uuid) to update_challenge_progress, not p_source_id (text)

CREATE OR REPLACE FUNCTION public.record_challenge_event(
  p_user_id uuid,
  p_event_type text,
  p_source_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_hash text;
  v_source_uuid uuid;
  v_inserted boolean := false;
BEGIN
  v_event_hash := md5(p_user_id::text || p_event_type || coalesce(p_source_id, ''));

  -- Safe cast: some events may pass non-uuid source ids
  BEGIN
    v_source_uuid := NULLIF(p_source_id, '')::uuid;
  EXCEPTION WHEN others THEN
    v_source_uuid := NULL;
  END;

  INSERT INTO public.challenge_event_log (
    user_id,
    event_type,
    source_id,
    event_hash,
    processed
  )
  VALUES (
    p_user_id,
    p_event_type,
    v_source_uuid,
    v_event_hash,
    false
  )
  ON CONFLICT (event_hash) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    -- FIX: Use v_source_uuid (uuid) instead of p_source_id (text)
    PERFORM public.update_challenge_progress(p_user_id, p_event_type, v_source_uuid);
  END IF;

  RETURN json_build_object(
    'success', true,
    'new_event', v_inserted,
    'event_hash', v_event_hash
  );
END;
$$;-- Drop and recreate join_match_v2 with JSON return type

DROP FUNCTION IF EXISTS public.join_match_v2(uuid);

CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_match record;
  v_entry_fee numeric;
  v_balance numeric;
  v_participant_count int;
  v_max_participants int;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get match details with lock
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Check match is open
  IF v_match.status != 'open' THEN
    RETURN json_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;

  -- Check match not expired
  IF v_match.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Match has expired');
  END IF;

  -- Check not already in match
  IF EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are already in this match');
  END IF;

  -- Check user doesn't have another active match
  IF public.has_active_match(v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'You already have an active match');
  END IF;

  -- For team matches (team_size > 1), don't allow direct join
  IF v_match.team_size > 1 THEN
    RETURN json_build_object('success', false, 'error', 'Team matches require joining with a team');
  END IF;

  -- Get entry fee and check balance
  v_entry_fee := v_match.entry_fee;
  
  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = v_user_id;

  IF v_balance IS NULL OR v_balance < v_entry_fee THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Count current participants
  SELECT COUNT(*) INTO v_participant_count
  FROM public.match_participants
  WHERE match_id = p_match_id;

  v_max_participants := v_match.team_size * 2;

  IF v_participant_count >= v_max_participants THEN
    RETURN json_build_object('success', false, 'error', 'Match is full');
  END IF;

  -- Lock funds
  UPDATE public.wallets
  SET balance = balance - v_entry_fee,
      locked_balance = locked_balance + v_entry_fee,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Create transaction record
  INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
  VALUES (v_user_id, 'match_entry', -v_entry_fee, p_match_id, 'Match entry fee locked', 'completed');

  -- Add participant with ready = true for 1v1
  INSERT INTO public.match_participants (match_id, user_id, team_side, ready, ready_at)
  VALUES (p_match_id, v_user_id, 'B', true, now());

  -- Update match status to ready_check if now full (for 1v1, 2 players)
  IF v_participant_count + 1 >= v_max_participants THEN
    UPDATE public.matches
    SET status = 'ready_check',
        started_at = now()
    WHERE id = p_match_id;
  END IF;

  RETURN json_build_object('success', true, 'status', 'joined');
END;
$$;-- Fix join_match_v2 to use valid transaction type 'lock' instead of 'match_entry'
CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_match record;
  v_entry_fee numeric;
  v_balance numeric;
  v_participant_count int;
  v_max_participants int;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Get match details with lock
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Check match is open
  IF v_match.status != 'open' THEN
    RETURN json_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;

  -- Check match not expired
  IF v_match.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Match has expired');
  END IF;

  -- Check not already in match
  IF EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are already in this match');
  END IF;

  -- Check user doesn't have another active match
  IF public.has_active_match(v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'You already have an active match');
  END IF;

  -- For team matches (team_size > 1), don't allow direct join
  IF v_match.team_size > 1 THEN
    RETURN json_build_object('success', false, 'error', 'Team matches require joining with a team');
  END IF;

  -- Get entry fee and check balance
  v_entry_fee := v_match.entry_fee;
  
  SELECT balance INTO v_balance
  FROM public.wallets
  WHERE user_id = v_user_id;

  IF v_balance IS NULL OR v_balance < v_entry_fee THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Count current participants
  SELECT COUNT(*) INTO v_participant_count
  FROM public.match_participants
  WHERE match_id = p_match_id;

  v_max_participants := v_match.team_size * 2;

  IF v_participant_count >= v_max_participants THEN
    RETURN json_build_object('success', false, 'error', 'Match is full');
  END IF;

  -- Lock funds
  UPDATE public.wallets
  SET balance = balance - v_entry_fee,
      locked_balance = locked_balance + v_entry_fee,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Create transaction record with valid type 'lock'
  INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
  VALUES (v_user_id, 'lock', -v_entry_fee, p_match_id, 'Match entry fee locked', 'completed');

  -- Add participant with ready = true for 1v1
  INSERT INTO public.match_participants (match_id, user_id, team_side, ready, ready_at)
  VALUES (p_match_id, v_user_id, 'B', true, now());

  -- Update match status to ready_check if now full (for 1v1, 2 players)
  IF v_participant_count + 1 >= v_max_participants THEN
    UPDATE public.matches
    SET status = 'ready_check',
        started_at = now()
    WHERE id = p_match_id;
  END IF;

  RETURN json_build_object('success', true, 'status', 'joined');
END;
$function$;

-- Ensure match_participants is in realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'match_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_participants;
  END IF;
END $$;-- Create secure RPC for 1v1 match creation with active match validation
CREATE OR REPLACE FUNCTION public.create_match_1v1(
  p_region text,
  p_platform text,
  p_mode text,
  p_first_to integer,
  p_entry_fee numeric,
  p_is_private boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_match_id uuid;
  v_balance numeric;
  v_expires_at timestamp with time zone;
BEGIN
  v_user_id := auth.uid();
  
  -- Verify authentication
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- CRITICAL CHECK: Does user already have an active match?
  IF public.has_active_match(v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 
      'Hai già un match attivo. Completa o cancella il match esistente prima di crearne uno nuovo.');
  END IF;
  
  -- Verify wallet balance
  SELECT balance INTO v_balance FROM wallets WHERE user_id = v_user_id;
  IF v_balance IS NULL OR v_balance < p_entry_fee THEN
    RETURN json_build_object('success', false, 'error', 'Saldo insufficiente');
  END IF;
  
  -- Set expiration to 2 hours
  v_expires_at := now() + interval '2 hours';
  
  -- Create the match
  INSERT INTO matches (
    creator_id, game, region, platform, mode, team_size, first_to,
    entry_fee, is_private, status, expires_at
  ) VALUES (
    v_user_id, 'FN', p_region, p_platform, p_mode, 1, p_first_to,
    p_entry_fee, p_is_private, 'open', v_expires_at
  )
  RETURNING id INTO v_match_id;
  
  -- Lock funds in wallet
  UPDATE wallets
  SET balance = balance - p_entry_fee,
      locked_balance = locked_balance + p_entry_fee,
      updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Record the transaction
  INSERT INTO transactions (user_id, type, amount, match_id, description, status)
  VALUES (v_user_id, 'lock', -p_entry_fee, v_match_id, 'Match entry fee locked', 'completed');
  
  -- Add creator as participant (team_side = 'A')
  INSERT INTO match_participants (match_id, user_id, team_side)
  VALUES (v_match_id, v_user_id, 'A');
  
  RETURN json_build_object('success', true, 'match_id', v_match_id);
END;
$$;-- Fix finalize_team_match to properly handle COVER vs SPLIT payment modes
-- This prevents the wallets_locked_balance_check constraint violation

CREATE OR REPLACE FUNCTION public.finalize_team_match(p_match_id UUID, p_winner_side TEXT)
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
  v_winner_captain_id UUID;
  v_loser_captain_id UUID;
  v_payout_per_member NUMERIC;
  v_participant RECORD;
  v_existing_payout BOOLEAN;
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
    RETURN jsonb_build_object('success', false, 'error', 'Match not in valid state');
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
  
  -- Calculate prize pool: entry_fee * team_size * 2 teams, 10% fee
  v_total_pool := v_entry_fee * v_team_size * 2;
  v_platform_fee := v_total_pool * 0.10;
  v_prize_pool := v_total_pool - v_platform_fee;
  
  -- Determine payment modes and team IDs
  -- Team A = host, Team B = joiner
  IF p_winner_side = 'A' THEN
    v_winner_team_id := v_match.team_a_id;
    v_loser_team_id := v_match.team_b_id;
    v_winner_payment_mode := COALESCE(v_match.payment_mode_host, 'split');
    v_loser_payment_mode := COALESCE(v_match.payment_mode_joiner, 'split');
  ELSE
    v_winner_team_id := v_match.team_b_id;
    v_loser_team_id := v_match.team_a_id;
    v_winner_payment_mode := COALESCE(v_match.payment_mode_joiner, 'split');
    v_loser_payment_mode := COALESCE(v_match.payment_mode_host, 'split');
  END IF;
  
  -- Get captains (first joined player on each side)
  SELECT user_id INTO v_winner_captain_id
  FROM match_participants 
  WHERE match_id = p_match_id AND team_side = p_winner_side 
  ORDER BY joined_at ASC LIMIT 1;
  
  SELECT user_id INTO v_loser_captain_id
  FROM match_participants 
  WHERE match_id = p_match_id AND team_side = v_loser_side 
  ORDER BY joined_at ASC LIMIT 1;

  -- ========================================
  -- PROCESS LOSER SIDE (unlock locked funds)
  -- ========================================
  IF v_loser_payment_mode = 'cover' THEN
    -- COVER: Captain paid all, remove all locked from captain ONLY
    UPDATE wallets
    SET locked_balance = locked_balance - (v_entry_fee * v_team_size),
        updated_at = now()
    WHERE user_id = v_loser_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_loser_captain_id, 'fee', v_entry_fee * v_team_size, p_match_id, 
      'Match entry (loss - covered team)', 'completed');
    
    -- Record event for all losers
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = v_loser_side
    LOOP
      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
  ELSE
    -- SPLIT: Each member paid individually
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = v_loser_side
    LOOP
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
  IF v_winner_payment_mode = 'cover' THEN
    -- COVER: Captain paid all, captain receives all winnings
    UPDATE wallets
    SET balance = balance + v_prize_pool,
        locked_balance = locked_balance - (v_entry_fee * v_team_size),
        updated_at = now()
    WHERE user_id = v_winner_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_winner_captain_id, 'payout', v_prize_pool, p_match_id, 
      'Match winnings (covered team)', 'completed');
    
    -- Record event for all winners
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = p_winner_side
    LOOP
      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
  ELSE
    -- SPLIT: Each member paid individually, distribute prize equally
    v_payout_per_member := v_prize_pool / v_team_size;
    
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = p_winner_side
    LOOP
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
  INSERT INTO match_results (match_id, winner_team_id, status)
  VALUES (p_match_id, v_winner_team_id, 'confirmed')
  ON CONFLICT (match_id) DO UPDATE SET 
    winner_team_id = v_winner_team_id,
    status = 'confirmed',
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'message', 'Team match finalized successfully',
    'winner_team_id', v_winner_team_id
  );
END;
$$;-- =====================================================
-- MATCH SYSTEM REFACTOR: Single Source of Truth
-- Consolidates all match RPCs into a clean, unified system
-- =====================================================

-- ====================
-- 1. HELPER FUNCTIONS
-- ====================

-- has_active_match: Check if user is in an active match
CREATE OR REPLACE FUNCTION public.has_active_match(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = p_user_id
    AND m.status NOT IN ('finished', 'completed', 'admin_resolved', 'expired', 'canceled')
  );
END;
$$;

-- ====================
-- 2. UNIFIED RESULT DECLARATION
-- ====================

-- declare_result: Single entry point for all match types
-- Replaces: declare_match_result, submit_match_result, submit_team_result
CREATE OR REPLACE FUNCTION public.declare_result(
  p_match_id UUID,
  p_result TEXT  -- 'WIN' or 'LOSS'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_match RECORD;
  v_participant RECORD;
  v_user_team_side TEXT;
  v_is_team_match BOOLEAN;
  v_is_captain BOOLEAN;
  v_team_a_result TEXT;
  v_team_b_result TEXT;
  v_other_side_result TEXT;
  v_winner_side TEXT;
  v_finalize_result jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate result
  IF p_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result. Use WIN or LOSS');
  END IF;

  -- Lock match row
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Check match status
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not in a valid state for result declaration');
  END IF;

  -- Get user's participant record
  SELECT * INTO v_participant 
  FROM match_participants 
  WHERE match_id = p_match_id AND user_id = v_user_id;
  
  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not a participant in this match');
  END IF;

  v_user_team_side := v_participant.team_side;
  v_is_team_match := v_match.team_size > 1;

  -- For team matches, check if user is captain
  IF v_is_team_match THEN
    IF v_user_team_side = 'A' THEN
      v_is_captain := (v_user_id = v_match.creator_id);
    ELSE
      -- Captain of Team B is first to join that side
      SELECT (mp.user_id = v_user_id) INTO v_is_captain
      FROM match_participants mp
      WHERE mp.match_id = p_match_id AND mp.team_side = 'B'
      ORDER BY mp.joined_at ASC
      LIMIT 1;
    END IF;

    IF NOT v_is_captain THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the team captain can declare the result');
    END IF;
  END IF;

  -- Check if already declared (idempotency)
  IF v_is_team_match THEN
    -- For team match, check if ANY team member already declared
    SELECT result_choice INTO v_team_a_result
    FROM match_participants
    WHERE match_id = p_match_id AND team_side = 'A' AND result_choice IS NOT NULL
    LIMIT 1;
    
    SELECT result_choice INTO v_team_b_result
    FROM match_participants
    WHERE match_id = p_match_id AND team_side = 'B' AND result_choice IS NOT NULL
    LIMIT 1;
    
    IF (v_user_team_side = 'A' AND v_team_a_result IS NOT NULL) OR 
       (v_user_team_side = 'B' AND v_team_b_result IS NOT NULL) THEN
      RETURN jsonb_build_object(
        'success', true, 
        'status', 'already_submitted',
        'message', 'Result already declared for your team'
      );
    END IF;
  ELSE
    -- For 1v1, check user's own result
    IF v_participant.result_choice IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true, 
        'status', 'already_submitted',
        'message', 'You have already declared your result'
      );
    END IF;
  END IF;

  -- Record the result choice
  IF v_is_team_match THEN
    -- Update all team members with the same result
    UPDATE match_participants
    SET result_choice = p_result, result_at = now()
    WHERE match_id = p_match_id AND team_side = v_user_team_side;
  ELSE
    -- Update just this participant
    UPDATE match_participants
    SET result_choice = p_result, result_at = now()
    WHERE id = v_participant.id;
  END IF;

  -- Refresh the results after update
  SELECT result_choice INTO v_team_a_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side = 'A' AND result_choice IS NOT NULL
  LIMIT 1;
  
  SELECT result_choice INTO v_team_b_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side = 'B' AND result_choice IS NOT NULL
  LIMIT 1;

  -- Check if both sides have declared
  IF v_team_a_result IS NULL OR v_team_b_result IS NULL THEN
    -- Update match to result_pending if not already
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id AND status = 'in_progress';
    
    RETURN jsonb_build_object(
      'success', true,
      'status', 'pending',
      'message', 'Result recorded. Waiting for the other side to declare.'
    );
  END IF;

  -- Both sides have declared - determine outcome
  IF (v_team_a_result = 'WIN' AND v_team_b_result = 'LOSS') THEN
    v_winner_side := 'A';
  ELSIF (v_team_a_result = 'LOSS' AND v_team_b_result = 'WIN') THEN
    v_winner_side := 'B';
  ELSE
    -- Conflict: both claim WIN or both claim LOSS
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'status', 'disputed',
      'message', 'Results conflict. An admin will review this match.'
    );
  END IF;

  -- Finalize the match with the determined winner
  v_finalize_result := public.finalize_match_payout(p_match_id, v_winner_side);
  
  IF (v_finalize_result->>'success')::boolean THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'completed',
      'winner_side', v_winner_side,
      'winner_id', v_finalize_result->>'winner_id',
      'message', 'Match completed successfully!'
    );
  ELSE
    RETURN v_finalize_result;
  END IF;
END;
$$;


-- ====================
-- 3. UNIFIED FINALIZATION FUNCTION
-- ====================

-- finalize_match_payout: Handles all payouts for both 1v1 and team matches
-- Replaces: complete_match_payout, finalize_team_match
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
  v_winner_captain_id UUID;
  v_loser_captain_id UUID;
  v_payout_per_member NUMERIC;
  v_participant RECORD;
  v_existing_payout BOOLEAN;
  v_winner_user_id UUID;
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
  
  -- Calculate prize pool: entry_fee * team_size * 2 teams, 10% fee
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
  
  -- Get captains (first joined player on each side)
  SELECT user_id INTO v_winner_captain_id
  FROM match_participants 
  WHERE match_id = p_match_id AND team_side = p_winner_side 
  ORDER BY joined_at ASC LIMIT 1;
  
  SELECT user_id INTO v_loser_captain_id
  FROM match_participants 
  WHERE match_id = p_match_id AND team_side = v_loser_side 
  ORDER BY joined_at ASC LIMIT 1;

  -- Store winner ID for return
  v_winner_user_id := v_winner_captain_id;

  -- ========================================
  -- PROCESS LOSER SIDE (unlock locked funds)
  -- ========================================
  IF v_team_size = 1 THEN
    -- 1v1 match: simple deduction
    UPDATE wallets
    SET locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = v_loser_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_loser_captain_id, 'fee', v_entry_fee, p_match_id, 'Match entry (loss)', 'completed');
    
    PERFORM record_challenge_event(v_loser_captain_id, 'match_completed', p_match_id);
    
  ELSIF v_loser_payment_mode = 'cover' THEN
    -- COVER: Captain paid all, remove all locked from captain ONLY
    UPDATE wallets
    SET locked_balance = locked_balance - (v_entry_fee * v_team_size),
        updated_at = now()
    WHERE user_id = v_loser_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_loser_captain_id, 'fee', v_entry_fee * v_team_size, p_match_id, 
      'Match entry (loss - covered team)', 'completed');
    
    -- Record event for all losers
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = v_loser_side
    LOOP
      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
  ELSE
    -- SPLIT: Each member paid individually
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = v_loser_side
    LOOP
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
    -- 1v1 match: simple payout
    UPDATE wallets
    SET balance = balance + v_prize_pool,
        locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = v_winner_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_winner_captain_id, 'payout', v_prize_pool, p_match_id, 'Match winnings', 'completed');
    
    PERFORM record_challenge_event(v_winner_captain_id, 'match_completed', p_match_id);
    
  ELSIF v_winner_payment_mode = 'cover' THEN
    -- COVER: Captain paid all, captain receives all winnings
    UPDATE wallets
    SET balance = balance + v_prize_pool,
        locked_balance = locked_balance - (v_entry_fee * v_team_size),
        updated_at = now()
    WHERE user_id = v_winner_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_winner_captain_id, 'payout', v_prize_pool, p_match_id, 
      'Match winnings (covered team)', 'completed');
    
    -- Record event for all winners
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = p_winner_side
    LOOP
      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
  ELSE
    -- SPLIT: Each member paid individually, distribute prize equally
    v_payout_per_member := v_prize_pool / v_team_size;
    
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = p_winner_side
    LOOP
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
  VALUES (p_match_id, v_winner_captain_id, v_winner_team_id, 'confirmed')
  ON CONFLICT (match_id) DO UPDATE SET 
    winner_user_id = v_winner_captain_id,
    winner_team_id = v_winner_team_id,
    status = 'confirmed',
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'message', 'Match finalized successfully',
    'winner_id', v_winner_captain_id,
    'winner_team_id', v_winner_team_id,
    'prize_pool', v_prize_pool,
    'platform_fee', v_platform_fee
  );
END;
$$;


-- ====================
-- 4. KEEP OLD FUNCTIONS AS WRAPPERS (backward compatibility)
-- ====================

-- submit_match_result: wrapper for 1v1 (backward compatible)
CREATE OR REPLACE FUNCTION public.submit_match_result(
  p_match_id UUID,
  p_result TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.declare_result(p_match_id, p_result);
END;
$$;

-- submit_team_result: wrapper for teams (backward compatible)
CREATE OR REPLACE FUNCTION public.submit_team_result(
  p_match_id UUID,
  p_result TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.declare_result(p_match_id, p_result);
END;
$$;

-- Keep finalize_team_match as wrapper
CREATE OR REPLACE FUNCTION public.finalize_team_match(
  p_match_id UUID,
  p_winner_side TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.finalize_match_payout(p_match_id, p_winner_side);
END;
$$;

-- Keep complete_match_payout as wrapper for 1v1
CREATE OR REPLACE FUNCTION public.complete_match_payout(
  p_match_id UUID,
  p_winner_user_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_winner_side TEXT;
BEGIN
  -- Determine winner side from user_id
  SELECT team_side INTO v_winner_side
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = p_winner_user_id
  LIMIT 1;
  
  IF v_winner_side IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Winner not found in match');
  END IF;
  
  RETURN public.finalize_match_payout(p_match_id, v_winner_side);
END;
$$;


-- ====================
-- 5. NORMALIZE EXISTING MATCH STATUSES
-- ====================

-- Update any legacy statuses to standard ones
UPDATE matches SET status = 'in_progress' WHERE status IN ('full', 'started');
UPDATE matches SET status = 'finished' WHERE status = 'completed';-- =============================================
-- DROPS FIRST - Clear all functions that need new return types
-- =============================================
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer, integer, text);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer);
DROP FUNCTION IF EXISTS public.team_has_active_match(uuid);
DROP FUNCTION IF EXISTS public.delete_team(uuid);
DROP FUNCTION IF EXISTS public.set_player_ready(uuid);
DROP FUNCTION IF EXISTS public.join_match_v2(uuid);
DROP FUNCTION IF EXISTS public.join_team_match(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.join_team_match(uuid, uuid);

-- =============================================
-- FIX 1: Recreate create_team_match with single signature
-- =============================================

CREATE FUNCTION public.create_team_match(
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
  v_user_id UUID;
  v_match_id UUID;
  v_team_member RECORD;
  v_total_cost NUMERIC;
  v_per_member_cost NUMERIC;
  v_expires_at TIMESTAMPTZ;
  v_private_code TEXT;
  v_accepted_count INTEGER;
  v_payer_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM teams WHERE id = p_team_id AND owner_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be the team owner to create a match');
  END IF;

  SELECT COUNT(*) INTO v_accepted_count
  FROM team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  IF v_accepted_count < p_team_size THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Team needs %s accepted members, but only has %s', p_team_size, v_accepted_count)
    );
  END IF;

  FOR v_team_member IN
    SELECT tm.user_id, p.username
    FROM team_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LIMIT p_team_size
  LOOP
    IF public.has_active_match(v_team_member.user_id) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Team member %s is already in an active match', v_team_member.username)
      );
    END IF;
  END LOOP;

  v_total_cost := p_entry_fee * p_team_size;
  v_per_member_cost := p_entry_fee;

  IF p_payment_mode = 'cover' THEN
    IF NOT EXISTS (
      SELECT 1 FROM wallets WHERE user_id = v_user_id AND balance >= v_total_cost
    ) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Insufficient balance. You need %s coins to cover the team', v_total_cost)
      );
    END IF;
    v_payer_user_id := v_user_id;
  ELSE
    FOR v_team_member IN
      SELECT tm.user_id, p.username, w.balance
      FROM team_members tm
      JOIN profiles p ON p.user_id = tm.user_id
      JOIN wallets w ON w.user_id = tm.user_id
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
      LIMIT p_team_size
    LOOP
      IF v_team_member.balance < v_per_member_cost THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', format('Team member %s has insufficient balance (%s/%s coins)', 
            v_team_member.username, v_team_member.balance, v_per_member_cost)
        );
      END IF;
    END LOOP;
    v_payer_user_id := NULL;
  END IF;

  IF p_is_private THEN
    v_private_code := upper(substring(md5(random()::text) from 1 for 6));
  END IF;

  v_expires_at := now() + interval '30 minutes';

  INSERT INTO matches (
    creator_id, game, region, platform, mode, team_size, first_to,
    entry_fee, is_private, private_code, expires_at, status,
    team_a_id, payment_mode_host, host_payer_user_id
  ) VALUES (
    v_user_id, 'FN', p_region, p_platform, p_mode, p_team_size, p_first_to,
    p_entry_fee, p_is_private, v_private_code, v_expires_at, 'open',
    p_team_id, p_payment_mode, v_payer_user_id
  )
  RETURNING id INTO v_match_id;

  IF p_payment_mode = 'cover' THEN
    UPDATE wallets 
    SET balance = balance - v_total_cost,
        locked_balance = locked_balance + v_total_cost,
        updated_at = now()
    WHERE user_id = v_user_id;

    INSERT INTO transactions (user_id, type, amount, description, match_id, status)
    VALUES (v_user_id, 'lock', -v_total_cost, 'Team match entry (cover all)', v_match_id, 'completed');
  ELSE
    FOR v_team_member IN
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
      LIMIT p_team_size
    LOOP
      UPDATE wallets 
      SET balance = balance - v_per_member_cost,
          locked_balance = locked_balance + v_per_member_cost,
          updated_at = now()
      WHERE user_id = v_team_member.user_id;

      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_team_member.user_id, 'lock', -v_per_member_cost, 'Team match entry (split)', v_match_id, 'completed');
    END LOOP;
  END IF;

  INSERT INTO match_participants (match_id, user_id, team_id, team_side, status, joined_at)
  SELECT v_match_id, tm.user_id, p_team_id, 'A', 'joined', now()
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
  LIMIT p_team_size;

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id, 'private_code', v_private_code);
END;
$$;


-- =============================================
-- FIX 2: Team deletion with active match check
-- =============================================

CREATE FUNCTION public.team_has_active_match(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM matches m
    WHERE (m.team_a_id = p_team_id OR m.team_b_id = p_team_id)
    AND m.status NOT IN ('finished', 'expired', 'cancelled')
  );
END;
$$;

CREATE FUNCTION public.delete_team(p_team_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_team_name TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT name INTO v_team_name
  FROM teams 
  WHERE id = p_team_id AND owner_id = v_user_id;

  IF v_team_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found or you are not the owner');
  END IF;

  IF public.team_has_active_match(p_team_id) THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Cannot delete team: team has an active match. Wait for the match to finish first.'
    );
  END IF;

  DELETE FROM team_members WHERE team_id = p_team_id;
  DELETE FROM teams WHERE id = p_team_id;

  RETURN jsonb_build_object('success', true, 'message', format('Team "%s" deleted successfully', v_team_name));
END;
$$;


-- =============================================
-- FIX 3: Add ready_check_at column and fix timing
-- =============================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'matches' 
    AND column_name = 'ready_check_at'
  ) THEN
    ALTER TABLE public.matches ADD COLUMN ready_check_at TIMESTAMPTZ;
  END IF;
END $$;

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
    PERFORM public.record_challenge_event(v_user_id, 'ready_up_fast', p_match_id);
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

    FOR v_participant IN
      SELECT user_id FROM match_participants WHERE match_id = p_match_id
    LOOP
      PERFORM public.record_challenge_event(v_participant.user_id, 'match_created_started', p_match_id);
    END LOOP;
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


-- =============================================
-- Update join functions to set ready_check_at
-- =============================================

CREATE FUNCTION public.join_match_v2(p_match_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_match RECORD;
  v_entry_fee NUMERIC;
  v_wallet_balance NUMERIC;
  v_new_status TEXT;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;

  IF v_match.expires_at < now() THEN
    UPDATE matches SET status = 'expired' WHERE id = p_match_id;
    RETURN jsonb_build_object('success', false, 'error', 'Match has expired');
  END IF;

  IF v_match.creator_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot join your own match');
  END IF;

  IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = p_match_id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already in this match');
  END IF;

  IF public.has_active_match(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already in an active match');
  END IF;

  IF v_match.team_size != 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use join_team_match for team matches');
  END IF;

  v_entry_fee := v_match.entry_fee;

  SELECT balance INTO v_wallet_balance FROM wallets WHERE user_id = v_user_id;

  IF v_wallet_balance IS NULL OR v_wallet_balance < v_entry_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  UPDATE wallets
  SET balance = balance - v_entry_fee,
      locked_balance = locked_balance + v_entry_fee,
      updated_at = now()
  WHERE user_id = v_user_id;

  INSERT INTO transactions (user_id, type, amount, description, match_id, status)
  VALUES (v_user_id, 'lock', -v_entry_fee, 'Match entry fee', p_match_id, 'completed');

  INSERT INTO match_participants (match_id, user_id, team_side, status, joined_at)
  VALUES (p_match_id, v_user_id, 'B', 'joined', now());

  v_new_status := 'ready_check';
  
  UPDATE matches 
  SET status = v_new_status,
      joiner_payer_user_id = v_user_id,
      ready_check_at = now()
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true, 'status', v_new_status, 'message', 'Joined match successfully');
END;
$$;


CREATE FUNCTION public.join_team_match(
  p_match_id UUID,
  p_team_id UUID,
  p_payment_mode TEXT DEFAULT 'cover'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_match RECORD;
  v_team_member RECORD;
  v_entry_fee NUMERIC;
  v_total_cost NUMERIC;
  v_per_member_cost NUMERIC;
  v_accepted_count INTEGER;
  v_payer_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;

  IF v_match.expires_at < now() THEN
    UPDATE matches SET status = 'expired' WHERE id = p_match_id;
    RETURN jsonb_build_object('success', false, 'error', 'Match has expired');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM teams WHERE id = p_team_id AND owner_id = v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be the team owner to join with this team');
  END IF;

  IF v_match.team_a_id = p_team_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot join with the same team as the host');
  END IF;

  SELECT COUNT(*) INTO v_accepted_count
  FROM team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  IF v_accepted_count < v_match.team_size THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Team needs %s accepted members, but only has %s', v_match.team_size, v_accepted_count)
    );
  END IF;

  FOR v_team_member IN
    SELECT tm.user_id, p.username
    FROM team_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LIMIT v_match.team_size
  LOOP
    IF public.has_active_match(v_team_member.user_id) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Team member %s is already in an active match', v_team_member.username)
      );
    END IF;
  END LOOP;

  v_entry_fee := v_match.entry_fee;
  v_total_cost := v_entry_fee * v_match.team_size;
  v_per_member_cost := v_entry_fee;

  IF p_payment_mode = 'cover' THEN
    IF NOT EXISTS (SELECT 1 FROM wallets WHERE user_id = v_user_id AND balance >= v_total_cost) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Insufficient balance. You need %s coins to cover the team', v_total_cost)
      );
    END IF;
    v_payer_user_id := v_user_id;
  ELSE
    FOR v_team_member IN
      SELECT tm.user_id, p.username, w.balance
      FROM team_members tm
      JOIN profiles p ON p.user_id = tm.user_id
      JOIN wallets w ON w.user_id = tm.user_id
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
      LIMIT v_match.team_size
    LOOP
      IF v_team_member.balance < v_per_member_cost THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', format('Team member %s has insufficient balance', v_team_member.username)
        );
      END IF;
    END LOOP;
    v_payer_user_id := NULL;
  END IF;

  IF p_payment_mode = 'cover' THEN
    UPDATE wallets 
    SET balance = balance - v_total_cost,
        locked_balance = locked_balance + v_total_cost,
        updated_at = now()
    WHERE user_id = v_user_id;

    INSERT INTO transactions (user_id, type, amount, description, match_id, status)
    VALUES (v_user_id, 'lock', -v_total_cost, 'Team match entry (cover all)', p_match_id, 'completed');
  ELSE
    FOR v_team_member IN
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
      LIMIT v_match.team_size
    LOOP
      UPDATE wallets 
      SET balance = balance - v_per_member_cost,
          locked_balance = locked_balance + v_per_member_cost,
          updated_at = now()
      WHERE user_id = v_team_member.user_id;

      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_team_member.user_id, 'lock', -v_per_member_cost, 'Team match entry (split)', p_match_id, 'completed');
    END LOOP;
  END IF;

  INSERT INTO match_participants (match_id, user_id, team_id, team_side, status, joined_at)
  SELECT p_match_id, tm.user_id, p_team_id, 'B', 'joined', now()
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
  LIMIT v_match.team_size;

  UPDATE matches 
  SET status = 'ready_check',
      team_b_id = p_team_id,
      payment_mode_joiner = p_payment_mode,
      joiner_payer_user_id = v_payer_user_id,
      ready_check_at = now()
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true, 'status', 'ready_check', 'message', 'Team joined match successfully');
END;
$$;-- =============================================================================
-- FIX CRITICO: Eliminare ambiguità create_team_match
-- =============================================================================

-- Drop ALL possible overloaded versions of create_team_match
DROP FUNCTION IF EXISTS public.create_team_match(uuid, integer, text, text, text, integer, integer, boolean, text);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, integer, text, text, text, integer, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer, integer, text, boolean);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer, integer, boolean, text);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, integer, text, text, text, integer, integer, text);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer, integer, text);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, integer, text, text, text, integer);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer, integer);
DROP FUNCTION IF EXISTS public.create_team_match(uuid, integer, text, text, text, integer, integer);

-- Ricrea UNA SOLA versione canonica con firma chiara
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
  v_payer_wallet RECORD;
  v_private_code TEXT;
  v_accepted_count INTEGER;
BEGIN
  -- Validate user is authenticated
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate team exists and user is owner
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  
  IF v_team.owner_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can create matches');
  END IF;

  -- Count accepted members (including owner)
  SELECT COUNT(*) INTO v_accepted_count
  FROM team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  -- Validate team has enough members for the match size
  IF v_accepted_count < p_team_size THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', format('Team needs %s accepted members for %sv%s match (has %s)', 
                      p_team_size, p_team_size, p_team_size, v_accepted_count)
    );
  END IF;

  -- Check if any team member has an active match
  FOR v_member IN 
    SELECT tm.user_id, p.username
    FROM team_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
  LOOP
    IF public.has_active_match(v_member.user_id) THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Team member %s already has an active match', v_member.username)
      );
    END IF;
  END LOOP;

  -- Calculate fees
  v_total_entry := p_entry_fee * p_team_size;
  v_per_member_fee := p_entry_fee;

  -- Validate wallet balance based on payment mode
  IF p_payment_mode = 'cover' THEN
    -- Owner pays for entire team
    SELECT * INTO v_payer_wallet FROM wallets WHERE user_id = v_user_id;
    IF v_payer_wallet IS NULL OR v_payer_wallet.balance < v_total_entry THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', format('Insufficient balance. Need %s coins to cover team', v_total_entry)
      );
    END IF;
  ELSE
    -- Split: each member pays their share
    FOR v_member IN 
      SELECT tm.user_id, p.username, w.balance
      FROM team_members tm
      JOIN profiles p ON p.user_id = tm.user_id
      LEFT JOIN wallets w ON w.user_id = tm.user_id
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
      IF v_member.balance IS NULL OR v_member.balance < v_per_member_fee THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', format('Team member %s has insufficient balance', v_member.username)
        );
      END IF;
    END LOOP;
  END IF;

  -- Generate private code if needed
  IF p_is_private THEN
    v_private_code := upper(substr(md5(random()::text), 1, 6));
  END IF;

  -- Set expiration (24 hours)
  v_expires_at := now() + interval '24 hours';

  -- Create the match
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
    v_user_id,
    p_payment_mode
  )
  RETURNING id INTO v_match_id;

  -- Lock funds based on payment mode
  IF p_payment_mode = 'cover' THEN
    -- Owner pays for entire team
    UPDATE wallets 
    SET balance = balance - v_total_entry,
        locked_balance = locked_balance + v_total_entry,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- Record single lock transaction
    INSERT INTO transactions (user_id, type, amount, description, match_id, status)
    VALUES (v_user_id, 'lock', -v_total_entry, 
            format('Locked for team match (cover %s members)', p_team_size), 
            v_match_id, 'completed');
  ELSE
    -- Split: lock funds from each member
    FOR v_member IN 
      SELECT user_id FROM team_members 
      WHERE team_id = p_team_id AND status = 'accepted'
    LOOP
      UPDATE wallets 
      SET balance = balance - v_per_member_fee,
          locked_balance = locked_balance + v_per_member_fee,
          updated_at = now()
      WHERE user_id = v_member.user_id;

      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_member.user_id, 'lock', -v_per_member_fee, 
              'Locked for team match (split)', v_match_id, 'completed');
    END LOOP;
  END IF;

  -- Add all team members as participants
  FOR v_member IN 
    SELECT user_id FROM team_members 
    WHERE team_id = p_team_id AND status = 'accepted'
  LOOP
    INSERT INTO match_participants (match_id, user_id, team_side, team_id, status)
    VALUES (v_match_id, v_member.user_id, 'A', p_team_id, 'joined');
  END LOOP;

  RETURN jsonb_build_object(
    'success', true, 
    'match_id', v_match_id,
    'private_code', v_private_code
  );
END;
$$;-- ============================================================
-- FIX: Add persistent captain columns for stable result declaration
-- ============================================================

-- 1. Add captain columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS captain_a_user_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS captain_b_user_id UUID REFERENCES auth.users(id);

-- 2. Backfill Team A captain = always creator_id
UPDATE matches 
SET captain_a_user_id = creator_id
WHERE captain_a_user_id IS NULL;

-- 3. Backfill Team B captain for team matches = owner of the team that joined
UPDATE matches m
SET captain_b_user_id = t.owner_id
FROM teams t
WHERE m.team_b_id = t.id
  AND m.captain_b_user_id IS NULL
  AND m.team_size > 1;

-- 4. Backfill Team B captain for 1v1 = the user in team_side B
UPDATE matches m
SET captain_b_user_id = (
  SELECT user_id FROM match_participants 
  WHERE match_id = m.id AND team_side = 'B'
  LIMIT 1
)
WHERE m.captain_b_user_id IS NULL 
  AND m.team_size = 1
  AND EXISTS (
    SELECT 1 FROM match_participants 
    WHERE match_id = m.id AND team_side = 'B'
  );

-- 5. Update create_team_match to set captain_a_user_id
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
  v_caller_id UUID := auth.uid();
  v_match_id UUID;
  v_team RECORD;
  v_member RECORD;
  v_accepted_members UUID[];
  v_share NUMERIC;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Validate team ownership
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  IF v_team.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can create match');
  END IF;

  -- Get accepted members
  SELECT array_agg(user_id) INTO v_accepted_members
  FROM team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  IF v_accepted_members IS NULL OR array_length(v_accepted_members, 1) < p_team_size THEN
    RETURN jsonb_build_object('success', false, 'error', 
      format('Team needs %s accepted members, has %s', p_team_size, COALESCE(array_length(v_accepted_members, 1), 0)));
  END IF;

  -- Check no member has active match
  FOR v_member IN 
    SELECT tm.user_id, p.username
    FROM team_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LIMIT p_team_size
  LOOP
    IF public.has_active_match(v_member.user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 
        format('Member %s already has an active match', v_member.username));
    END IF;
  END LOOP;

  -- Calculate share per member
  v_share := CASE WHEN p_payment_mode = 'split' THEN p_entry_fee / p_team_size ELSE p_entry_fee END;
  v_expires_at := now() + interval '30 minutes';

  -- Create match with captain_a_user_id set to caller (team owner)
  INSERT INTO matches (
    creator_id, game, region, platform, mode, team_size, first_to,
    entry_fee, is_private, status, expires_at, team_a_id, payment_mode_host,
    captain_a_user_id
  ) VALUES (
    v_caller_id, 'Fortnite', p_region, p_platform, p_mode, p_team_size, p_first_to,
    p_entry_fee, p_is_private, 'open', v_expires_at, p_team_id, p_payment_mode,
    v_caller_id
  ) RETURNING id INTO v_match_id;

  -- Lock funds and add participants
  FOR v_member IN 
    SELECT tm.user_id
    FROM team_members tm
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    ORDER BY CASE WHEN tm.user_id = v_caller_id THEN 0 ELSE 1 END, tm.created_at
    LIMIT p_team_size
  LOOP
    IF p_payment_mode = 'cover' THEN
      -- Owner pays all
      IF v_member.user_id = v_caller_id THEN
        UPDATE wallets SET balance = balance - p_entry_fee, locked_balance = locked_balance + p_entry_fee
        WHERE user_id = v_caller_id AND balance >= p_entry_fee;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Insufficient balance';
        END IF;
        INSERT INTO transactions (user_id, type, amount, description, match_id, status)
        VALUES (v_caller_id, 'lock', p_entry_fee, 'Entry fee locked (cover all)', v_match_id, 'completed');
      END IF;
    ELSE
      -- Split payment
      UPDATE wallets SET balance = balance - v_share, locked_balance = locked_balance + v_share
      WHERE user_id = v_member.user_id AND balance >= v_share;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Member has insufficient balance';
      END IF;
      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_member.user_id, 'lock', v_share, 'Entry fee locked (split)', v_match_id, 'completed');
    END IF;

    INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
    VALUES (v_match_id, v_member.user_id, p_team_id, 'A', 'joined');
  END LOOP;

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id);
END;
$$;

-- 6. Update create_match_1v1 to set captain_a_user_id
CREATE OR REPLACE FUNCTION public.create_match_1v1(
  p_entry_fee NUMERIC,
  p_region TEXT,
  p_platform TEXT,
  p_mode TEXT,
  p_first_to INTEGER DEFAULT 3,
  p_is_private BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match_id UUID;
  v_balance NUMERIC;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Check caller doesn't have active match
  IF public.has_active_match(v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active match');
  END IF;

  -- Check balance
  SELECT balance INTO v_balance FROM wallets WHERE user_id = v_caller_id;
  IF v_balance IS NULL OR v_balance < p_entry_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  v_expires_at := now() + interval '30 minutes';

  -- Create match with captain_a_user_id set
  INSERT INTO matches (
    creator_id, game, region, platform, mode, team_size, first_to,
    entry_fee, is_private, status, expires_at, payment_mode_host,
    captain_a_user_id
  ) VALUES (
    v_caller_id, 'Fortnite', p_region, p_platform, p_mode, 1, p_first_to,
    p_entry_fee, p_is_private, 'open', v_expires_at, 'cover',
    v_caller_id
  ) RETURNING id INTO v_match_id;

  -- Lock funds
  UPDATE wallets SET balance = balance - p_entry_fee, locked_balance = locked_balance + p_entry_fee
  WHERE user_id = v_caller_id;

  INSERT INTO transactions (user_id, type, amount, description, match_id, status)
  VALUES (v_caller_id, 'lock', p_entry_fee, 'Entry fee locked', v_match_id, 'completed');

  -- Add as participant
  INSERT INTO match_participants (match_id, user_id, team_side, status)
  VALUES (v_match_id, v_caller_id, 'A', 'joined');

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id);
END;
$$;

-- 7. Update join_team_match to set captain_b_user_id
CREATE OR REPLACE FUNCTION public.join_team_match(
  p_match_id UUID,
  p_team_id UUID,
  p_payment_mode TEXT DEFAULT 'cover'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_team RECORD;
  v_member RECORD;
  v_accepted_members UUID[];
  v_share NUMERIC;
BEGIN
  -- Validate match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not open');
  END IF;
  IF v_match.team_a_id = p_team_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot join with same team');
  END IF;

  -- Validate team ownership
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  IF v_team.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can join match');
  END IF;

  -- Get accepted members
  SELECT array_agg(user_id) INTO v_accepted_members
  FROM team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  IF v_accepted_members IS NULL OR array_length(v_accepted_members, 1) < v_match.team_size THEN
    RETURN jsonb_build_object('success', false, 'error', 
      format('Team needs %s accepted members', v_match.team_size));
  END IF;

  -- Check no member has active match
  FOR v_member IN 
    SELECT tm.user_id, p.username
    FROM team_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LIMIT v_match.team_size
  LOOP
    IF public.has_active_match(v_member.user_id) THEN
      RETURN jsonb_build_object('success', false, 'error', 
        format('Member %s already has an active match', v_member.username));
    END IF;
  END LOOP;

  -- Calculate share
  v_share := CASE WHEN p_payment_mode = 'split' THEN v_match.entry_fee / v_match.team_size ELSE v_match.entry_fee END;

  -- Lock funds and add participants
  FOR v_member IN 
    SELECT tm.user_id
    FROM team_members tm
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    ORDER BY CASE WHEN tm.user_id = v_caller_id THEN 0 ELSE 1 END, tm.created_at
    LIMIT v_match.team_size
  LOOP
    IF p_payment_mode = 'cover' THEN
      IF v_member.user_id = v_caller_id THEN
        UPDATE wallets SET balance = balance - v_match.entry_fee, locked_balance = locked_balance + v_match.entry_fee
        WHERE user_id = v_caller_id AND balance >= v_match.entry_fee;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Insufficient balance';
        END IF;
        INSERT INTO transactions (user_id, type, amount, description, match_id, status)
        VALUES (v_caller_id, 'lock', v_match.entry_fee, 'Entry fee locked (cover all)', p_match_id, 'completed');
      END IF;
    ELSE
      UPDATE wallets SET balance = balance - v_share, locked_balance = locked_balance + v_share
      WHERE user_id = v_member.user_id AND balance >= v_share;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Member has insufficient balance';
      END IF;
      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_member.user_id, 'lock', v_share, 'Entry fee locked (split)', p_match_id, 'completed');
    END IF;

    INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
    VALUES (p_match_id, v_member.user_id, p_team_id, 'B', 'joined');
  END LOOP;

  -- Update match with team_b_id, payment_mode_joiner, status, AND captain_b_user_id
  UPDATE matches SET 
    team_b_id = p_team_id,
    payment_mode_joiner = p_payment_mode,
    status = 'ready_check',
    captain_b_user_id = v_caller_id
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. Update join_match_v2 for 1v1 to set captain_b_user_id
CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_balance NUMERIC;
BEGIN
  -- Validate match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;
  IF v_match.status != 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not open');
  END IF;
  IF v_match.creator_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot join your own match');
  END IF;
  IF v_match.team_size != 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Use join_team_match for team matches');
  END IF;

  -- Check active match
  IF public.has_active_match(v_caller_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have an active match');
  END IF;

  -- Check balance
  SELECT balance INTO v_balance FROM wallets WHERE user_id = v_caller_id;
  IF v_balance IS NULL OR v_balance < v_match.entry_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Lock funds
  UPDATE wallets SET balance = balance - v_match.entry_fee, locked_balance = locked_balance + v_match.entry_fee
  WHERE user_id = v_caller_id;

  INSERT INTO transactions (user_id, type, amount, description, match_id, status)
  VALUES (v_caller_id, 'lock', v_match.entry_fee, 'Entry fee locked', p_match_id, 'completed');

  -- Add as participant
  INSERT INTO match_participants (match_id, user_id, team_side, status)
  VALUES (p_match_id, v_caller_id, 'B', 'joined');

  -- Update match status AND set captain_b_user_id
  UPDATE matches SET 
    status = 'ready_check',
    captain_b_user_id = v_caller_id
  WHERE id = p_match_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 9. Update declare_result to use captain columns instead of ORDER BY joined_at
CREATE OR REPLACE FUNCTION public.declare_result(
  p_match_id UUID,
  p_result TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match RECORD;
  v_participant RECORD;
  v_user_team_side TEXT;
  v_is_captain BOOLEAN;
  v_other_team_result TEXT;
  v_winner_side TEXT;
  v_loser_side TEXT;
BEGIN
  -- Get match with captain columns
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not in progress', 'status', v_match.status);
  END IF;

  -- Get caller's participant record
  SELECT * INTO v_participant FROM match_participants 
  WHERE match_id = p_match_id AND user_id = v_caller_id;
  
  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not in this match');
  END IF;

  v_user_team_side := v_participant.team_side;

  -- Check if caller is captain using persistent columns
  IF v_match.team_size > 1 THEN
    -- Team match: use captain columns
    v_is_captain := (v_user_team_side = 'A' AND v_caller_id = v_match.captain_a_user_id)
                 OR (v_user_team_side = 'B' AND v_caller_id = v_match.captain_b_user_id);
    
    IF NOT v_is_captain THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Only the team captain can declare the result',
        'caller_user_id', v_caller_id,
        'expected_captain_user_id', CASE WHEN v_user_team_side = 'A' THEN v_match.captain_a_user_id ELSE v_match.captain_b_user_id END,
        'team_side', v_user_team_side
      );
    END IF;
  END IF;

  -- Check if already declared
  IF v_participant.result_choice IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already declared a result', 'status', 'already_submitted');
  END IF;

  -- Update participant result
  UPDATE match_participants 
  SET result_choice = p_result, result_at = now()
  WHERE id = v_participant.id;

  -- Update match status
  UPDATE matches SET status = 'result_pending' WHERE id = p_match_id AND status = 'in_progress';

  -- Check opponent result (for team matches, check other team's captain)
  IF v_match.team_size > 1 THEN
    -- Get opponent captain's result
    SELECT mp.result_choice INTO v_other_team_result
    FROM match_participants mp
    WHERE mp.match_id = p_match_id 
      AND mp.user_id = CASE WHEN v_user_team_side = 'A' THEN v_match.captain_b_user_id ELSE v_match.captain_a_user_id END;
  ELSE
    -- 1v1: get opponent's result
    SELECT result_choice INTO v_other_team_result
    FROM match_participants
    WHERE match_id = p_match_id AND team_side != v_user_team_side;
  END IF;

  -- If opponent hasn't declared yet
  IF v_other_team_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'waiting_opponent');
  END IF;

  -- Both have declared - check for agreement
  IF (p_result = 'WIN' AND v_other_team_result = 'LOSS') OR (p_result = 'LOSS' AND v_other_team_result = 'WIN') THEN
    -- Agreement reached
    v_winner_side := CASE WHEN p_result = 'WIN' THEN v_user_team_side ELSE (CASE WHEN v_user_team_side = 'A' THEN 'B' ELSE 'A' END) END;
    v_loser_side := CASE WHEN v_winner_side = 'A' THEN 'B' ELSE 'A' END;

    IF v_match.team_size > 1 THEN
      PERFORM public.finalize_team_match(p_match_id, v_winner_side);
    ELSE
      PERFORM public.finalize_match_payout(p_match_id, v_winner_side);
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'completed', 'winner_side', v_winner_side);
  ELSE
    -- Dispute
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;
    RETURN jsonb_build_object('success', true, 'status', 'disputed');
  END IF;
END;
$$;-- Fix: finalize_match_payout uses captain_a/b_user_id columns instead of unstable ORDER BY joined_at
-- This fixes the wallets_locked_balance_check constraint violation

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
  v_winner_captain_id UUID;
  v_loser_captain_id UUID;
  v_payout_per_member NUMERIC;
  v_participant RECORD;
  v_existing_payout BOOLEAN;
  v_winner_user_id UUID;
  v_wallet_check RECORD;
  v_expected_locked NUMERIC;
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
  
  -- Calculate prize pool: entry_fee * team_size * 2 teams, 10% fee
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
  
  -- ============================================================
  -- FIX: Use persistent captain columns instead of ORDER BY joined_at
  -- ============================================================
  v_winner_captain_id := CASE 
    WHEN p_winner_side = 'A' THEN v_match.captain_a_user_id 
    ELSE v_match.captain_b_user_id 
  END;
  
  v_loser_captain_id := CASE 
    WHEN v_loser_side = 'A' THEN v_match.captain_a_user_id 
    ELSE v_match.captain_b_user_id 
  END;
  
  -- Fallback for legacy matches without captain columns
  IF v_winner_captain_id IS NULL THEN
    SELECT user_id INTO v_winner_captain_id
    FROM match_participants 
    WHERE match_id = p_match_id AND team_side = p_winner_side 
    ORDER BY joined_at ASC LIMIT 1;
  END IF;
  
  IF v_loser_captain_id IS NULL THEN
    SELECT user_id INTO v_loser_captain_id
    FROM match_participants 
    WHERE match_id = p_match_id AND team_side = v_loser_side 
    ORDER BY joined_at ASC LIMIT 1;
  END IF;

  -- Store winner ID for return
  v_winner_user_id := v_winner_captain_id;

  -- ============================================================
  -- PRE-CONDITION CHECK: Lock wallets and verify locked_balance
  -- ============================================================
  
  -- For COVER mode, check captain has enough locked balance
  IF v_team_size > 1 AND v_loser_payment_mode = 'cover' THEN
    v_expected_locked := v_entry_fee * v_team_size;
    SELECT * INTO v_wallet_check FROM wallets 
    WHERE user_id = v_loser_captain_id FOR UPDATE;
    
    IF v_wallet_check.locked_balance < v_expected_locked THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Insufficient locked balance for loser captain',
        'expected', v_expected_locked,
        'actual', v_wallet_check.locked_balance,
        'captain_id', v_loser_captain_id
      );
    END IF;
  END IF;
  
  IF v_team_size > 1 AND v_winner_payment_mode = 'cover' THEN
    v_expected_locked := v_entry_fee * v_team_size;
    SELECT * INTO v_wallet_check FROM wallets 
    WHERE user_id = v_winner_captain_id FOR UPDATE;
    
    IF v_wallet_check.locked_balance < v_expected_locked THEN
      RETURN jsonb_build_object(
        'success', false, 
        'error', 'Insufficient locked balance for winner captain',
        'expected', v_expected_locked,
        'actual', v_wallet_check.locked_balance,
        'captain_id', v_winner_captain_id
      );
    END IF;
  END IF;

  -- ========================================
  -- PROCESS LOSER SIDE (unlock locked funds)
  -- ========================================
  IF v_team_size = 1 THEN
    -- 1v1 match: simple deduction
    UPDATE wallets
    SET locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = v_loser_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_loser_captain_id, 'fee', v_entry_fee, p_match_id, 'Match entry (loss)', 'completed');
    
    PERFORM record_challenge_event(v_loser_captain_id, 'match_completed', p_match_id);
    
  ELSIF v_loser_payment_mode = 'cover' THEN
    -- COVER: Captain paid all, remove all locked from captain ONLY
    UPDATE wallets
    SET locked_balance = locked_balance - (v_entry_fee * v_team_size),
        updated_at = now()
    WHERE user_id = v_loser_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_loser_captain_id, 'fee', v_entry_fee * v_team_size, p_match_id, 
      'Match entry (loss - covered team)', 'completed');
    
    -- Record event for all losers
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = v_loser_side
    LOOP
      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
  ELSE
    -- SPLIT: Each member paid individually
    FOR v_participant IN 
      SELECT mp.user_id, w.locked_balance 
      FROM match_participants mp
      JOIN wallets w ON w.user_id = mp.user_id
      WHERE mp.match_id = p_match_id AND mp.team_side = v_loser_side
      FOR UPDATE OF w
    LOOP
      -- Pre-check for split mode
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
    -- 1v1 match: simple payout
    UPDATE wallets
    SET balance = balance + v_prize_pool,
        locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = v_winner_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_winner_captain_id, 'payout', v_prize_pool, p_match_id, 'Match winnings', 'completed');
    
    PERFORM record_challenge_event(v_winner_captain_id, 'match_completed', p_match_id);
    
  ELSIF v_winner_payment_mode = 'cover' THEN
    -- COVER: Captain paid all, captain receives all winnings
    UPDATE wallets
    SET balance = balance + v_prize_pool,
        locked_balance = locked_balance - (v_entry_fee * v_team_size),
        updated_at = now()
    WHERE user_id = v_winner_captain_id AND id IS NOT NULL;
    
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_winner_captain_id, 'payout', v_prize_pool, p_match_id, 
      'Match winnings (covered team)', 'completed');
    
    -- Record event for all winners
    FOR v_participant IN 
      SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = p_winner_side
    LOOP
      PERFORM record_challenge_event(v_participant.user_id, 'match_completed', p_match_id);
    END LOOP;
  ELSE
    -- SPLIT: Each member paid individually, distribute prize equally
    v_payout_per_member := v_prize_pool / v_team_size;
    
    FOR v_participant IN 
      SELECT mp.user_id, w.locked_balance 
      FROM match_participants mp
      JOIN wallets w ON w.user_id = mp.user_id
      WHERE mp.match_id = p_match_id AND mp.team_side = p_winner_side
      FOR UPDATE OF w
    LOOP
      -- Pre-check for split mode
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
  VALUES (p_match_id, v_winner_captain_id, v_winner_team_id, 'confirmed')
  ON CONFLICT (match_id) DO UPDATE SET 
    winner_user_id = v_winner_captain_id,
    winner_team_id = v_winner_team_id,
    status = 'confirmed',
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'status', 'completed',
    'message', 'Match finalized successfully',
    'winner_id', v_winner_captain_id,
    'winner_team_id', v_winner_team_id,
    'prize_pool', v_prize_pool,
    'platform_fee', v_platform_fee
  );
END;
$$;-- Fix 1: Recreate create_team_match with correct lock amount for COVER mode
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
  p_payment_mode text DEFAULT 'cover'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_team teams%ROWTYPE;
  v_match_id uuid;
  v_expires_at timestamptz;
  v_active_count integer;
  v_total_lock numeric;
  v_member record;
  v_member_share numeric;
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

  -- 3. Check no active match for any team member
  FOR v_member IN 
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT p_team_size
  LOOP
    SELECT COUNT(*) INTO v_active_count
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = v_member.user_id
      AND m.status NOT IN ('completed', 'cancelled', 'expired', 'admin_resolved');
    
    IF v_active_count > 0 THEN
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
    
    -- Record single transaction for owner
    INSERT INTO transactions (user_id, type, amount, description, reference_id)
    VALUES (v_caller_id, 'lock', v_total_lock, 'Match entry locked (covering team)', NULL);
    
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
      
      INSERT INTO transactions (user_id, type, amount, description)
      VALUES (v_member.user_id, 'lock', v_member_share, 'Match entry locked (split)');
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

  -- 7. Update transaction references
  UPDATE transactions 
  SET reference_id = v_match_id 
  WHERE reference_id IS NULL 
    AND type = 'lock' 
    AND user_id IN (SELECT user_id FROM match_participants WHERE match_id = v_match_id);

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id);
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Fix 2: Recreate join_team_match with correct lock amount for COVER mode
CREATE OR REPLACE FUNCTION public.join_team_match(
  p_match_id uuid,
  p_team_id uuid,
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
  v_team teams%ROWTYPE;
  v_total_lock numeric;
  v_member_share numeric;
  v_member record;
  v_active_count integer;
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

  -- 5. Check no active match for any team member
  FOR v_member IN 
    SELECT tm.user_id FROM team_members tm WHERE tm.team_id = p_team_id AND tm.status = 'accepted' LIMIT v_match.team_size
  LOOP
    SELECT COUNT(*) INTO v_active_count
    FROM match_participants mp
    JOIN matches m ON m.id = mp.match_id
    WHERE mp.user_id = v_member.user_id
      AND m.status NOT IN ('completed', 'cancelled', 'expired', 'admin_resolved');
    
    IF v_active_count > 0 THEN
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
    
    INSERT INTO transactions (user_id, type, amount, description, reference_id)
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
      
      INSERT INTO transactions (user_id, type, amount, description, reference_id)
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
    updated_at = now()
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
$$;

-- Fix 3: Recreate declare_result to properly capture and propagate finalize errors
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
  v_opponent_result text;
  v_winner_side text;
  v_is_captain boolean;
  v_finalize_result jsonb;
BEGIN
  -- Validate result value
  IF p_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result. Must be WIN or LOSS');
  END IF;

  -- Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Check match is in valid state for result declaration
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not in a state that allows result declaration');
  END IF;

  -- Get caller's participation
  SELECT * INTO v_participant 
  FROM match_participants 
  WHERE match_id = p_match_id AND user_id = v_caller_id;
  
  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not a participant in this match');
  END IF;

  -- For team matches (team_size > 1), only captain can declare
  IF v_match.team_size > 1 THEN
    v_is_captain := (
      (v_participant.team_side = 'A' AND v_match.captain_a_user_id = v_caller_id) OR
      (v_participant.team_side = 'B' AND v_match.captain_b_user_id = v_caller_id)
    );
    
    IF NOT v_is_captain THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only team captain can declare results');
    END IF;
  END IF;

  -- Check if this team already submitted
  IF v_participant.result_choice IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Result already declared', 'status', 'already_submitted', 'message', 'Hai già dichiarato il risultato per questo team');
  END IF;

  -- Save result for this participant (and all team members for consistency)
  UPDATE match_participants 
  SET result_choice = p_result, updated_at = now()
  WHERE match_id = p_match_id AND team_side = v_participant.team_side;

  -- Update match status to result_pending if not already
  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending', updated_at = now() WHERE id = p_match_id;
  END IF;

  -- Check opponent's result
  SELECT result_choice INTO v_opponent_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side != v_participant.team_side
  LIMIT 1;

  -- If opponent hasn't declared yet, we wait
  IF v_opponent_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'waiting_opponent', 'message', 'In attesa della dichiarazione avversaria');
  END IF;

  -- Both sides have declared - determine outcome
  IF (p_result = 'WIN' AND v_opponent_result = 'LOSS') THEN
    -- Agreement: caller's team won
    v_winner_side := v_participant.team_side;
  ELSIF (p_result = 'LOSS' AND v_opponent_result = 'WIN') THEN
    -- Agreement: opponent's team won
    v_winner_side := CASE WHEN v_participant.team_side = 'A' THEN 'B' ELSE 'A' END;
  ELSE
    -- Conflict: both claim WIN or both claim LOSS -> dispute
    UPDATE matches SET status = 'disputed', updated_at = now() WHERE id = p_match_id;
    
    -- Create dispute record if match_results table exists for this purpose
    INSERT INTO match_results (match_id, status, team_a_result, team_b_result)
    VALUES (
      p_match_id, 
      'disputed',
      CASE WHEN v_participant.team_side = 'A' THEN p_result ELSE v_opponent_result END,
      CASE WHEN v_participant.team_side = 'B' THEN p_result ELSE v_opponent_result END
    )
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      team_a_result = EXCLUDED.team_a_result,
      team_b_result = EXCLUDED.team_b_result,
      updated_at = now();
    
    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'message', 'Risultati in conflitto. Un admin esaminerà il match.');
  END IF;

  -- Agreement reached - finalize match and process payout
  -- Use SELECT INTO to capture the result instead of PERFORM (which ignores it)
  SELECT public.finalize_match_payout(p_match_id, v_winner_side) INTO v_finalize_result;
  
  -- Check if finalize succeeded
  IF v_finalize_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Finalize returned null', 'status', 'finalize_failed');
  END IF;
  
  IF NOT COALESCE((v_finalize_result->>'success')::boolean, false) THEN
    -- Finalize failed - return the error to the frontend
    RETURN jsonb_build_object(
      'success', false, 
      'error', COALESCE(v_finalize_result->>'error', 'Unknown finalize error'),
      'status', 'finalize_failed',
      'message', 'Errore durante la finalizzazione del match. Contatta il supporto.'
    );
  END IF;

  -- Success!
  RETURN jsonb_build_object(
    'success', true, 
    'status', 'completed', 
    'winner_side', v_winner_side,
    'message', 'Match completato con successo!'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'status', 'exception');
END;
$$;-- Drop existing function with old return type
DROP FUNCTION IF EXISTS public.expire_stale_matches();

-- Recreate with jsonb return type and persistent captain columns
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
  -- Find all matches that have expired but are still open or in ready_check
  FOR v_match IN 
    SELECT m.*, 
           m.captain_a_user_id,
           m.captain_b_user_id
    FROM matches m
    WHERE m.status IN ('open', 'ready_check', 'joined', 'full')
      AND m.expires_at < now()
  LOOP
    RAISE NOTICE '[expire_stale_matches] Processing match % (status: %, expires_at: %)', 
      v_match.id, v_match.status, v_match.expires_at;

    -- Process refunds based on team size
    IF v_match.team_size = 1 THEN
      -- 1v1: refund each participant directly
      FOR v_participant IN
        SELECT mp.user_id, mp.team_side
        FROM match_participants mp
        WHERE mp.match_id = v_match.id
      LOOP
        UPDATE wallets
        SET balance = balance + v_match.entry_fee,
            locked_balance = locked_balance - v_match.entry_fee
        WHERE user_id = v_participant.user_id
          AND locked_balance >= v_match.entry_fee;

        IF FOUND THEN
          INSERT INTO transactions (user_id, type, amount, match_id, description)
          VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                  'Match expired - automatic refund');
          v_refunded_total := v_refunded_total + v_match.entry_fee;
        END IF;
      END LOOP;
    ELSE
      -- Team match: Team A refund
      IF v_match.payment_mode_a = 'cover' THEN
        v_captain_id := v_match.captain_a_user_id;
        IF v_captain_id IS NULL THEN
          SELECT mp.user_id INTO v_captain_id
          FROM match_participants mp
          WHERE mp.match_id = v_match.id AND mp.team_side = 'A'
          ORDER BY mp.joined_at ASC LIMIT 1;
        END IF;
        
        IF v_captain_id IS NOT NULL THEN
          v_refund_amount := v_match.entry_fee * v_match.team_size;
          UPDATE wallets
          SET balance = balance + v_refund_amount,
              locked_balance = locked_balance - v_refund_amount
          WHERE user_id = v_captain_id AND locked_balance >= v_refund_amount;

          IF FOUND THEN
            INSERT INTO transactions (user_id, type, amount, match_id, description)
            VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 
                    'Match expired - captain refund (cover mode)');
            v_refunded_total := v_refunded_total + v_refund_amount;
          END IF;
        END IF;
      ELSE
        FOR v_participant IN
          SELECT mp.user_id FROM match_participants mp
          WHERE mp.match_id = v_match.id AND mp.team_side = 'A'
        LOOP
          UPDATE wallets
          SET balance = balance + v_match.entry_fee,
              locked_balance = locked_balance - v_match.entry_fee
          WHERE user_id = v_participant.user_id AND locked_balance >= v_match.entry_fee;

          IF FOUND THEN
            INSERT INTO transactions (user_id, type, amount, match_id, description)
            VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                    'Match expired - automatic refund (split mode)');
            v_refunded_total := v_refunded_total + v_match.entry_fee;
          END IF;
        END LOOP;
      END IF;

      -- Team B refund (if joined)
      IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = v_match.id AND team_side = 'B') THEN
        IF v_match.payment_mode_b = 'cover' THEN
          v_captain_id := v_match.captain_b_user_id;
          IF v_captain_id IS NULL THEN
            SELECT mp.user_id INTO v_captain_id
            FROM match_participants mp
            WHERE mp.match_id = v_match.id AND mp.team_side = 'B'
            ORDER BY mp.joined_at ASC LIMIT 1;
          END IF;
          
          IF v_captain_id IS NOT NULL THEN
            v_refund_amount := v_match.entry_fee * v_match.team_size;
            UPDATE wallets
            SET balance = balance + v_refund_amount,
                locked_balance = locked_balance - v_refund_amount
            WHERE user_id = v_captain_id AND locked_balance >= v_refund_amount;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 
                      'Match expired - captain refund (cover mode)');
              v_refunded_total := v_refunded_total + v_refund_amount;
            END IF;
          END IF;
        ELSE
          FOR v_participant IN
            SELECT mp.user_id FROM match_participants mp
            WHERE mp.match_id = v_match.id AND mp.team_side = 'B'
          LOOP
            UPDATE wallets
            SET balance = balance + v_match.entry_fee,
                locked_balance = locked_balance - v_match.entry_fee
            WHERE user_id = v_participant.user_id AND locked_balance >= v_match.entry_fee;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                      'Match expired - automatic refund (split mode)');
              v_refunded_total := v_refunded_total + v_match.entry_fee;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;

    -- Update match status to expired
    UPDATE matches SET status = 'expired', updated_at = now() WHERE id = v_match.id;
    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'refunded_total', v_refunded_total,
    'processed_at', now()
  );
END;
$$;-- Fix expire_stale_matches to use correct column names
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
  -- Find all matches that have expired but are still open or in ready_check
  FOR v_match IN 
    SELECT m.*
    FROM matches m
    WHERE m.status IN ('open', 'ready_check', 'joined', 'full')
      AND m.expires_at < now()
  LOOP
    RAISE NOTICE '[expire_stale_matches] Processing match % (status: %, expires_at: %)', 
      v_match.id, v_match.status, v_match.expires_at;

    -- Process refunds based on team size
    IF v_match.team_size = 1 THEN
      -- 1v1: refund each participant directly
      FOR v_participant IN
        SELECT mp.user_id, mp.team_side
        FROM match_participants mp
        WHERE mp.match_id = v_match.id
      LOOP
        UPDATE wallets
        SET balance = balance + v_match.entry_fee,
            locked_balance = locked_balance - v_match.entry_fee
        WHERE user_id = v_participant.user_id
          AND locked_balance >= v_match.entry_fee;

        IF FOUND THEN
          INSERT INTO transactions (user_id, type, amount, match_id, description)
          VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                  'Match expired - automatic refund');
          v_refunded_total := v_refunded_total + v_match.entry_fee;
        END IF;
      END LOOP;
    ELSE
      -- Team match: Team A refund using payment_mode_host
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
          UPDATE wallets
          SET balance = balance + v_refund_amount,
              locked_balance = locked_balance - v_refund_amount
          WHERE user_id = v_captain_id AND locked_balance >= v_refund_amount;

          IF FOUND THEN
            INSERT INTO transactions (user_id, type, amount, match_id, description)
            VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 
                    'Match expired - captain refund (cover mode)');
            v_refunded_total := v_refunded_total + v_refund_amount;
          END IF;
        END IF;
      ELSE
        -- Split mode: refund each Team A member
        FOR v_participant IN
          SELECT mp.user_id FROM match_participants mp
          WHERE mp.match_id = v_match.id AND mp.team_side = 'A'
        LOOP
          UPDATE wallets
          SET balance = balance + v_match.entry_fee,
              locked_balance = locked_balance - v_match.entry_fee
          WHERE user_id = v_participant.user_id AND locked_balance >= v_match.entry_fee;

          IF FOUND THEN
            INSERT INTO transactions (user_id, type, amount, match_id, description)
            VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                    'Match expired - automatic refund (split mode)');
            v_refunded_total := v_refunded_total + v_match.entry_fee;
          END IF;
        END LOOP;
      END IF;

      -- Team B refund using payment_mode_joiner (if joined)
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
            UPDATE wallets
            SET balance = balance + v_refund_amount,
                locked_balance = locked_balance - v_refund_amount
            WHERE user_id = v_captain_id AND locked_balance >= v_refund_amount;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 
                      'Match expired - captain refund (cover mode)');
              v_refunded_total := v_refunded_total + v_refund_amount;
            END IF;
          END IF;
        ELSE
          -- Split mode: refund each Team B member
          FOR v_participant IN
            SELECT mp.user_id FROM match_participants mp
            WHERE mp.match_id = v_match.id AND mp.team_side = 'B'
          LOOP
            UPDATE wallets
            SET balance = balance + v_match.entry_fee,
                locked_balance = locked_balance - v_match.entry_fee
            WHERE user_id = v_participant.user_id AND locked_balance >= v_match.entry_fee;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                      'Match expired - automatic refund (split mode)');
              v_refunded_total := v_refunded_total + v_match.entry_fee;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;

    -- Update match status to expired
    UPDATE matches SET status = 'expired', updated_at = now() WHERE id = v_match.id;
    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'refunded_total', v_refunded_total,
    'processed_at', now()
  );
END;
$$;-- Fix expire_stale_matches to not use updated_at column
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
  -- Find all matches that have expired but are still open or in ready_check
  FOR v_match IN 
    SELECT m.*
    FROM matches m
    WHERE m.status IN ('open', 'ready_check', 'joined', 'full')
      AND m.expires_at < now()
  LOOP
    RAISE NOTICE '[expire_stale_matches] Processing match % (status: %, expires_at: %)', 
      v_match.id, v_match.status, v_match.expires_at;

    -- Process refunds based on team size
    IF v_match.team_size = 1 THEN
      -- 1v1: refund each participant directly
      FOR v_participant IN
        SELECT mp.user_id, mp.team_side
        FROM match_participants mp
        WHERE mp.match_id = v_match.id
      LOOP
        UPDATE wallets
        SET balance = balance + v_match.entry_fee,
            locked_balance = locked_balance - v_match.entry_fee
        WHERE user_id = v_participant.user_id
          AND locked_balance >= v_match.entry_fee;

        IF FOUND THEN
          INSERT INTO transactions (user_id, type, amount, match_id, description)
          VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                  'Match expired - automatic refund');
          v_refunded_total := v_refunded_total + v_match.entry_fee;
        END IF;
      END LOOP;
    ELSE
      -- Team match: Team A refund using payment_mode_host
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
          UPDATE wallets
          SET balance = balance + v_refund_amount,
              locked_balance = locked_balance - v_refund_amount
          WHERE user_id = v_captain_id AND locked_balance >= v_refund_amount;

          IF FOUND THEN
            INSERT INTO transactions (user_id, type, amount, match_id, description)
            VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 
                    'Match expired - captain refund (cover mode)');
            v_refunded_total := v_refunded_total + v_refund_amount;
          END IF;
        END IF;
      ELSE
        -- Split mode: refund each Team A member
        FOR v_participant IN
          SELECT mp.user_id FROM match_participants mp
          WHERE mp.match_id = v_match.id AND mp.team_side = 'A'
        LOOP
          UPDATE wallets
          SET balance = balance + v_match.entry_fee,
              locked_balance = locked_balance - v_match.entry_fee
          WHERE user_id = v_participant.user_id AND locked_balance >= v_match.entry_fee;

          IF FOUND THEN
            INSERT INTO transactions (user_id, type, amount, match_id, description)
            VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                    'Match expired - automatic refund (split mode)');
            v_refunded_total := v_refunded_total + v_match.entry_fee;
          END IF;
        END LOOP;
      END IF;

      -- Team B refund using payment_mode_joiner (if joined)
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
            UPDATE wallets
            SET balance = balance + v_refund_amount,
                locked_balance = locked_balance - v_refund_amount
            WHERE user_id = v_captain_id AND locked_balance >= v_refund_amount;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 
                      'Match expired - captain refund (cover mode)');
              v_refunded_total := v_refunded_total + v_refund_amount;
            END IF;
          END IF;
        ELSE
          -- Split mode: refund each Team B member
          FOR v_participant IN
            SELECT mp.user_id FROM match_participants mp
            WHERE mp.match_id = v_match.id AND mp.team_side = 'B'
          LOOP
            UPDATE wallets
            SET balance = balance + v_match.entry_fee,
                locked_balance = locked_balance - v_match.entry_fee
            WHERE user_id = v_participant.user_id AND locked_balance >= v_match.entry_fee;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                      'Match expired - automatic refund (split mode)');
              v_refunded_total := v_refunded_total + v_match.entry_fee;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;

    -- Update match status to expired
    UPDATE matches SET status = 'expired' WHERE id = v_match.id;
    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'refunded_total', v_refunded_total,
    'processed_at', now()
  );
END;
$$;-- Fix ambiguous overloads for create_match_1v1 by enforcing a single canonical signature

-- 1) Drop all known overloads (order+types) to remove ambiguity
DROP FUNCTION IF EXISTS public.create_match_1v1(text, text, text, integer, numeric, boolean);
DROP FUNCTION IF EXISTS public.create_match_1v1(numeric, text, text, text, integer, boolean);

-- 2) Recreate ONE canonical create_match_1v1 signature (numeric entry fee; jsonb return)
CREATE OR REPLACE FUNCTION public.create_match_1v1(
  p_entry_fee numeric,
  p_region text,
  p_platform text,
  p_mode text,
  p_first_to integer DEFAULT 3,
  p_is_private boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match_id uuid;
  v_balance numeric;
  v_expires_at timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Ensure caller does not already have an active match
  IF public.has_active_match(v_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Hai già un match attivo. Completa o cancella il match esistente prima di crearne uno nuovo.'
    );
  END IF;

  -- Check balance
  SELECT balance INTO v_balance FROM wallets WHERE user_id = v_user_id;
  IF v_balance IS NULL OR v_balance < p_entry_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Saldo insufficiente');
  END IF;

  -- Same base expiry behavior as team matches
  v_expires_at := now() + interval '30 minutes';

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
    status,
    expires_at,
    payment_mode_host,
    host_payer_user_id,
    captain_a_user_id
  ) VALUES (
    v_user_id,
    'FN',
    p_region,
    p_platform,
    p_mode,
    1,
    p_first_to,
    p_entry_fee,
    p_is_private,
    'open',
    v_expires_at,
    'cover',
    v_user_id,
    v_user_id
  )
  RETURNING id INTO v_match_id;

  -- Lock funds
  UPDATE wallets
  SET balance = balance - p_entry_fee,
      locked_balance = locked_balance + p_entry_fee,
      updated_at = now()
  WHERE user_id = v_user_id;

  -- Record transaction (amount positive, consistent with team refund logic)
  INSERT INTO transactions (user_id, type, amount, description, match_id, status)
  VALUES (v_user_id, 'lock', p_entry_fee, 'Entry fee locked', v_match_id, 'completed');

  -- Add creator as participant
  INSERT INTO match_participants (match_id, user_id, team_side, status)
  VALUES (v_match_id, v_user_id, 'A', 'joined');

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id);
END;
$$;

-- 3) Optional: provide a non-overloaded legacy wrapper for older call patterns
CREATE OR REPLACE FUNCTION public.create_match_1v1_legacy(
  p_region text,
  p_platform text,
  p_mode text,
  p_first_to integer,
  p_entry_fee numeric,
  p_is_private boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.create_match_1v1(
    p_entry_fee := p_entry_fee,
    p_region := p_region,
    p_platform := p_platform,
    p_mode := p_mode,
    p_first_to := p_first_to,
    p_is_private := p_is_private
  );
END;
$$;-- Admin-only legacy cleanup: purge an impossible/legacy match safely while keeping transactions

CREATE OR REPLACE FUNCTION public.admin_purge_legacy_match(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_match record;

  v_user_id uuid;
  v_lock_sum numeric;
  v_refund_unlock_sum numeric;
  v_delta numeric;
  v_wallet_locked numeric;
  v_wallet_balance numeric;
  v_refund_amount numeric;

  v_deleted_participants integer := 0;
  v_deleted_results integer := 0;
  v_deleted_proofs integer := 0;
  v_deleted_chat integer := 0;
  v_deleted_match integer := 0;

  v_refunds jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
BEGIN
  -- Admin gate
  SELECT public.is_admin() INTO v_is_admin;
  IF COALESCE(v_is_admin, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  -- Lock + validate match
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('match_id', p_match_id, 'status', 'not_found');
  END IF;

  IF v_match.status IS DISTINCT FROM 'expired' THEN
    RETURN jsonb_build_object(
      'match_id', p_match_id,
      'status', 'skipped',
      'reason', 'match_not_expired',
      'match_status', v_match.status
    );
  END IF;

  -- Safety: only allow purging older matches (prevents touching new flows accidentally)
  IF v_match.created_at > (now() - interval '6 hours') THEN
    RETURN jsonb_build_object(
      'match_id', p_match_id,
      'status', 'skipped',
      'reason', 'too_recent',
      'created_at', v_match.created_at
    );
  END IF;

  -- Refund any missing locked funds per user (cap to wallet.locked_balance to avoid negative)
  FOR v_user_id IN
    (SELECT DISTINCT user_id FROM public.transactions WHERE match_id = p_match_id)
  LOOP
    SELECT
      COALESCE(SUM(CASE WHEN type = 'lock' THEN amount ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN type IN ('refund','unlock') THEN amount ELSE 0 END), 0)
    INTO v_lock_sum, v_refund_unlock_sum
    FROM public.transactions
    WHERE match_id = p_match_id
      AND user_id = v_user_id
      AND status = 'completed';

    v_delta := v_lock_sum - v_refund_unlock_sum;

    IF v_delta > 0 THEN
      -- Lock wallet row
      SELECT balance, locked_balance
      INTO v_wallet_balance, v_wallet_locked
      FROM public.wallets
      WHERE user_id = v_user_id
      FOR UPDATE;

      IF NOT FOUND THEN
        v_warnings := v_warnings || jsonb_build_array(
          jsonb_build_object('type','missing_wallet','user_id',v_user_id,'delta',v_delta)
        );
      ELSE
        v_refund_amount := LEAST(v_delta, COALESCE(v_wallet_locked, 0));

        IF v_refund_amount <= 0 THEN
          v_warnings := v_warnings || jsonb_build_array(
            jsonb_build_object('type','locked_balance_too_low','user_id',v_user_id,'delta',v_delta,'wallet_locked',v_wallet_locked)
          );
        ELSE
          UPDATE public.wallets
          SET balance = balance + v_refund_amount,
              locked_balance = locked_balance - v_refund_amount,
              updated_at = now()
          WHERE user_id = v_user_id;

          INSERT INTO public.transactions (
            user_id,
            type,
            amount,
            status,
            match_id,
            provider,
            description,
            created_at
          ) VALUES (
            v_user_id,
            'refund',
            v_refund_amount,
            'completed',
            p_match_id,
            'internal',
            'Legacy cleanup refund (admin purge)',
            now()
          );

          v_refunds := v_refunds || jsonb_build_array(
            jsonb_build_object('user_id', v_user_id, 'refund_amount', v_refund_amount, 'delta_detected', v_delta)
          );

          IF v_refund_amount < v_delta THEN
            v_warnings := v_warnings || jsonb_build_array(
              jsonb_build_object(
                'type','refund_capped',
                'user_id',v_user_id,
                'delta_detected',v_delta,
                'refund_amount',v_refund_amount,
                'wallet_locked',v_wallet_locked
              )
            );
          END IF;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Delete operational match records (keep transactions)
  DELETE FROM public.match_results WHERE match_id = p_match_id;
  GET DIAGNOSTICS v_deleted_results = ROW_COUNT;

  DELETE FROM public.match_proofs WHERE match_id = p_match_id;
  GET DIAGNOSTICS v_deleted_proofs = ROW_COUNT;

  DELETE FROM public.match_chat_messages WHERE match_id = p_match_id;
  GET DIAGNOSTICS v_deleted_chat = ROW_COUNT;

  DELETE FROM public.match_participants WHERE match_id = p_match_id;
  GET DIAGNOSTICS v_deleted_participants = ROW_COUNT;

  DELETE FROM public.matches WHERE id = p_match_id;
  GET DIAGNOSTICS v_deleted_match = ROW_COUNT;

  -- Audit log (best-effort)
  BEGIN
    INSERT INTO public.admin_action_logs (admin_user_id, action_type, target_type, target_id, details, created_at)
    VALUES (
      auth.uid(),
      'purge_legacy_match',
      'match',
      p_match_id,
      jsonb_build_object(
        'refunds', v_refunds,
        'deleted', jsonb_build_object(
          'match', v_deleted_match,
          'participants', v_deleted_participants,
          'results', v_deleted_results,
          'proofs', v_deleted_proofs,
          'chat', v_deleted_chat
        ),
        'warnings', v_warnings
      ),
      now()
    );
  EXCEPTION WHEN OTHERS THEN
    -- ignore audit failures
    NULL;
  END;

  RETURN jsonb_build_object(
    'match_id', p_match_id,
    'status', 'purged',
    'refunds', v_refunds,
    'deleted', jsonb_build_object(
      'match', v_deleted_match,
      'participants', v_deleted_participants,
      'results', v_deleted_results,
      'proofs', v_deleted_proofs,
      'chat', v_deleted_chat
    ),
    'warnings', v_warnings
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_legacy_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_purge_legacy_match(uuid) TO authenticated;-- Fix 1: prevent authenticated users from reading all profile rows with sensitive fields
DO $$
BEGIN
  -- Drop overly broad policy if present
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Authenticated can view public profile data'
  ) THEN
    EXECUTE 'DROP POLICY "Authenticated can view public profile data" ON public.profiles';
  END IF;
END $$;

-- Re-create the safe public profile view (no email/paypal/iban) as SECURITY INVOKER
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
  SELECT
    p.id,
    p.user_id,
    p.username,
    p.avatar_url,
    p.epic_username,
    p.preferred_region,
    p.preferred_platform,
    p.created_at
  FROM public.profiles p;

-- Ensure the API roles can read the safe view
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- Fix 2: restrict match participant data visibility and avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_match_participant(p_match_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
      AND mp.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_match_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_match_participant(uuid, uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'match_participants'
      AND policyname = 'Participants viewable by all'
  ) THEN
    EXECUTE 'DROP POLICY "Participants viewable by all" ON public.match_participants';
  END IF;
END $$;

CREATE POLICY "Participants and admins can view match participants"
ON public.match_participants
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR public.is_match_participant(match_participants.match_id, auth.uid())
);
-- Tighten RLS on challenge system + notifications tables to prevent direct client tampering

-- 1) user_challenge_progress: keep read-own; remove permissive "system" mutation policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_challenge_progress' AND policyname='System can insert progress'
  ) THEN
    EXECUTE 'DROP POLICY "System can insert progress" ON public.user_challenge_progress';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_challenge_progress' AND policyname='System can update progress'
  ) THEN
    EXECUTE 'DROP POLICY "System can update progress" ON public.user_challenge_progress';
  END IF;
END $$;

-- (No INSERT/UPDATE/DELETE policies added here on purpose:
-- all writes must go through SECURITY DEFINER RPCs.)


-- 2) user_xp: remove permissive mutation policy; keep existing SELECT policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_xp' AND policyname='System can manage XP'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage XP" ON public.user_xp';
  END IF;
END $$;

-- (No INSERT/UPDATE/DELETE policies added here on purpose.)


-- 3) challenge_event_log: block direct access
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='challenge_event_log' AND policyname='System can manage event log'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage event log" ON public.challenge_event_log';
  END IF;
END $$;

-- Explicitly deny direct SELECT (and therefore ALL direct access)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='challenge_event_log' AND policyname='No direct access to event log'
  ) THEN
    EXECUTE 'CREATE POLICY "No direct access to event log" ON public.challenge_event_log FOR SELECT USING (false)';
  END IF;
END $$;


-- 4) challenge_anti_abuse: block direct access
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='challenge_anti_abuse' AND policyname='System can manage anti-abuse'
  ) THEN
    EXECUTE 'DROP POLICY "System can manage anti-abuse" ON public.challenge_anti_abuse';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='challenge_anti_abuse' AND policyname='No direct access to anti-abuse'
  ) THEN
    EXECUTE 'CREATE POLICY "No direct access to anti-abuse" ON public.challenge_anti_abuse FOR SELECT USING (false)';
  END IF;
END $$;


-- 5) notifications: remove permissive insert, allow insert only for self, keep existing read/update-own
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications' AND policyname='System can insert notifications'
  ) THEN
    EXECUTE 'DROP POLICY "System can insert notifications" ON public.notifications';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='notifications' AND policyname='Users can insert own notifications'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id)';
  END IF;
END $$;
-- Public leaderboard access without exposing raw match participant data
-- Provide SECURITY DEFINER RPCs that return only aggregated leaderboard rows.

CREATE OR REPLACE FUNCTION public.get_leaderboard(p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  wins bigint,
  total_matches bigint,
  total_earnings numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.user_id,
    p.username,
    p.avatar_url,
    count(DISTINCT CASE WHEN mr.winner_user_id = p.user_id AND mr.status = 'confirmed' THEN mr.match_id ELSE NULL END) AS wins,
    count(DISTINCT mp.match_id) AS total_matches,
    COALESCE(sum(CASE WHEN mr.winner_user_id = p.user_id AND mr.status = 'confirmed' THEN m.entry_fee * 1.9 ELSE 0 END), 0) AS total_earnings
  FROM public.profiles_public p
  LEFT JOIN public.match_participants mp ON mp.user_id = p.user_id
  LEFT JOIN public.matches m ON m.id = mp.match_id AND m.status = 'finished'
  LEFT JOIN public.match_results mr ON mr.match_id = m.id
  GROUP BY p.id, p.user_id, p.username, p.avatar_url
  ORDER BY wins DESC, total_earnings DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer, integer) TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.get_leaderboard_weekly(p_limit integer DEFAULT 10)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  weekly_earned numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.username,
    p.avatar_url,
    COALESCE(
      sum(
        CASE
          WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount
          ELSE 0
        END
      ),
      0
    ) AS weekly_earned
  FROM public.profiles_public p
  LEFT JOIN public.transactions t
    ON t.user_id = p.user_id
   AND t.created_at >= date_trunc('week', now())
   AND t.type = 'payout'
  GROUP BY p.user_id, p.username, p.avatar_url
  HAVING COALESCE(
      sum(
        CASE
          WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount
          ELSE 0
        END
      ),
      0
    ) > 0
  ORDER BY weekly_earned DESC
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard_weekly(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard_weekly(integer) TO anon, authenticated;


-- Also fix the weekly leaderboard view to be security invoker (linter), even though the app will use the RPC.
CREATE OR REPLACE VIEW public.leaderboard_weekly
WITH (security_invoker=on) AS
  SELECT
    p.user_id,
    p.username,
    p.avatar_url,
    COALESCE(
      sum(
        CASE
          WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount
          ELSE 0
        END
      ),
      0
    ) AS weekly_earned
  FROM public.profiles_public p
  LEFT JOIN public.transactions t
    ON t.user_id = p.user_id
   AND t.created_at >= date_trunc('week', now())
   AND t.type = 'payout'
  GROUP BY p.user_id, p.username, p.avatar_url
  HAVING COALESCE(
      sum(
        CASE
          WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount
          ELSE 0
        END
      ),
      0
    ) > 0
  ORDER BY weekly_earned DESC
  LIMIT 10;

GRANT SELECT ON public.leaderboard_weekly TO anon, authenticated;
-- Make proofs bucket private and move proof references to stored paths + signed URLs

-- 1) Make bucket private
UPDATE storage.buckets
SET public = false
WHERE id = 'proofs';

-- 2) Store canonical storage path on match_proofs
ALTER TABLE public.match_proofs
ADD COLUMN IF NOT EXISTS storage_path text;

-- Backfill storage_path for existing rows that stored public URLs
UPDATE public.match_proofs
SET storage_path = split_part(image_url, '/proofs/', 2)
WHERE storage_path IS NULL
  AND image_url LIKE '%/proofs/%';

-- 3) New RPC for creating proof rows using storage path (client will use signed URLs for display)
CREATE OR REPLACE FUNCTION public.create_match_proof_v2(
  p_match_id uuid,
  p_storage_path text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_exists boolean;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing storage path');
  END IF;

  -- Must be a participant (or admin)
  SELECT EXISTS (
    SELECT 1
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
      AND mp.user_id = v_user_id
  ) INTO v_exists;

  IF NOT v_exists AND NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Insert proof row. We store the storage path (not a public URL)
  INSERT INTO public.match_proofs (match_id, user_id, image_url, storage_path)
  VALUES (p_match_id, v_user_id, p_storage_path, p_storage_path);

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_match_proof_v2(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_match_proof_v2(uuid, text) TO authenticated;
-- Fix: declare_result must not reference non-existent match_participants.updated_at
-- Minimal patch: replace only the affected UPDATE, keep logic unchanged.
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
  v_opponent_result text;
  v_winner_side text;
  v_is_captain boolean;
  v_finalize_result jsonb;
BEGIN
  -- Validate result value
  IF p_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result. Must be WIN or LOSS');
  END IF;

  -- Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Check match is in valid state for result declaration
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not in a state that allows result declaration');
  END IF;

  -- Get caller's participation
  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_caller_id;

  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not a participant in this match');
  END IF;

  -- For team matches (team_size > 1), only captain can declare
  IF v_match.team_size > 1 THEN
    v_is_captain := (
      (v_participant.team_side = 'A' AND v_match.captain_a_user_id = v_caller_id) OR
      (v_participant.team_side = 'B' AND v_match.captain_b_user_id = v_caller_id)
    );

    IF NOT v_is_captain THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only team captain can declare results');
    END IF;
  END IF;

  -- Check if this team already submitted
  IF v_participant.result_choice IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Result already declared', 'status', 'already_submitted', 'message', 'Hai già dichiarato il risultato per questo team');
  END IF;

  -- Save result for this participant (and all team members for consistency)
  -- IMPORTANT: match_participants has no updated_at column. Use result_at.
  UPDATE match_participants
  SET result_choice = p_result,
      result_at = now()
  WHERE match_id = p_match_id AND team_side = v_participant.team_side;

  -- Update match status to result_pending if not already
  IF v_match.status = 'in_progress' THEN
    UPDATE matches SET status = 'result_pending', updated_at = now() WHERE id = p_match_id;
  END IF;

  -- Check opponent's result
  SELECT result_choice INTO v_opponent_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side != v_participant.team_side
  LIMIT 1;

  -- If opponent hasn't declared yet, we wait
  IF v_opponent_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'waiting_opponent', 'message', 'In attesa della dichiarazione avversaria');
  END IF;

  -- Both sides have declared - determine outcome
  IF (p_result = 'WIN' AND v_opponent_result = 'LOSS') THEN
    -- Agreement: caller's team won
    v_winner_side := v_participant.team_side;
  ELSIF (p_result = 'LOSS' AND v_opponent_result = 'WIN') THEN
    -- Agreement: opponent's team won
    v_winner_side := CASE WHEN v_participant.team_side = 'A' THEN 'B' ELSE 'A' END;
  ELSE
    -- Conflict: both claim WIN or both claim LOSS -> dispute
    UPDATE matches SET status = 'disputed', updated_at = now() WHERE id = p_match_id;

    -- Create dispute record if match_results table exists for this purpose
    INSERT INTO match_results (match_id, status, team_a_result, team_b_result)
    VALUES (
      p_match_id,
      'disputed',
      CASE WHEN v_participant.team_side = 'A' THEN p_result ELSE v_opponent_result END,
      CASE WHEN v_participant.team_side = 'B' THEN p_result ELSE v_opponent_result END
    )
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      team_a_result = EXCLUDED.team_a_result,
      team_b_result = EXCLUDED.team_b_result,
      updated_at = now();

    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'message', 'Risultati in conflitto. Un admin esaminerà il match.');
  END IF;

  -- Agreement reached - finalize match and process payout
  SELECT public.finalize_match_payout(p_match_id, v_winner_side) INTO v_finalize_result;

  -- Check if finalize succeeded
  IF v_finalize_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Finalize returned null', 'status', 'finalize_failed');
  END IF;

  IF NOT COALESCE((v_finalize_result->>'success')::boolean, false) THEN
    -- Finalize failed - return the error to the frontend
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_finalize_result->>'error', 'Unknown finalize error'),
      'status', 'finalize_failed',
      'message', 'Errore durante la finalizzazione del match. Contatta il supporto.'
    );
  END IF;

  -- Success!
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


-- Fix: provide match details (including safe participant profiles) without relying on profiles_public view joins
-- Keeps profiles RLS tight; access is restricted to participants/admins.
CREATE OR REPLACE FUNCTION public.get_match_details(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_allowed boolean;
  v_is_admin boolean;
  v_match jsonb;
  v_creator jsonb;
  v_participants jsonb;
  v_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  v_is_admin := public.is_admin();

  SELECT (v_is_admin OR public.is_match_participant(p_match_id, v_caller_id))
    INTO v_is_allowed;

  IF NOT COALESCE(v_is_allowed, false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Match row
  SELECT to_jsonb(m.*) INTO v_match
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Creator (safe fields only)
  SELECT to_jsonb(row)
  INTO v_creator
  FROM (
    SELECT p.user_id, p.username, p.avatar_url, p.epic_username
    FROM public.profiles p
    WHERE p.user_id = (v_match->>'creator_id')::uuid
  ) row;

  -- Participants with safe profiles
  SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY (row.joined_at)), '[]'::jsonb)
  INTO v_participants
  FROM (
    SELECT
      mp.*,
      (
        SELECT to_jsonb(pp)
        FROM (
          SELECT p.user_id, p.username, p.avatar_url, p.epic_username
          FROM public.profiles p
          WHERE p.user_id = mp.user_id
        ) pp
      ) AS profile
    FROM public.match_participants mp
    WHERE mp.match_id = p_match_id
  ) row;

  -- Result row (if any)
  SELECT to_jsonb(r.*)
  INTO v_result
  FROM public.match_results r
  WHERE r.match_id = p_match_id
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'match', v_match || jsonb_build_object(
      'creator', v_creator,
      'participants', v_participants,
      'result', v_result
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;-- Surgical fix: remove references to non-existent matches.updated_at (and ensure no match_participants.updated_at usage)

-- 1) declare_result: keep logic identical, only remove matches.updated_at writes
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
  v_opponent_result text;
  v_winner_side text;
  v_is_captain boolean;
  v_finalize_result jsonb;
BEGIN
  -- Validate result value
  IF p_result NOT IN ('WIN', 'LOSS') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid result. Must be WIN or LOSS');
  END IF;

  -- Lock and fetch match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Check match is in valid state for result declaration
  IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match is not in a state that allows result declaration');
  END IF;

  -- Get caller's participation
  SELECT * INTO v_participant
  FROM match_participants
  WHERE match_id = p_match_id AND user_id = v_caller_id;

  IF v_participant IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not a participant in this match');
  END IF;

  -- For team matches (team_size > 1), only captain can declare
  IF v_match.team_size > 1 THEN
    v_is_captain := (
      (v_participant.team_side = 'A' AND v_match.captain_a_user_id = v_caller_id) OR
      (v_participant.team_side = 'B' AND v_match.captain_b_user_id = v_caller_id)
    );

    IF NOT v_is_captain THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only team captain can declare results');
    END IF;
  END IF;

  -- Check if this team already submitted
  IF v_participant.result_choice IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Result already declared', 'status', 'already_submitted', 'message', 'Hai già dichiarato il risultato per questo team');
  END IF;

  -- Save result for this participant (and all team members for consistency)
  -- IMPORTANT: match_participants has no updated_at column. Use result_at.
  UPDATE match_participants
  SET result_choice = p_result,
      result_at = now()
  WHERE match_id = p_match_id AND team_side = v_participant.team_side;

  -- Update match status to result_pending if not already
  IF v_match.status = 'in_progress' THEN
    -- matches has no updated_at column
    UPDATE matches SET status = 'result_pending' WHERE id = p_match_id;
  END IF;

  -- Check opponent's result
  SELECT result_choice INTO v_opponent_result
  FROM match_participants
  WHERE match_id = p_match_id AND team_side != v_participant.team_side
  LIMIT 1;

  -- If opponent hasn't declared yet, we wait
  IF v_opponent_result IS NULL THEN
    RETURN jsonb_build_object('success', true, 'status', 'waiting_opponent', 'message', 'In attesa della dichiarazione avversaria');
  END IF;

  -- Both sides have declared - determine outcome
  IF (p_result = 'WIN' AND v_opponent_result = 'LOSS') THEN
    -- Agreement: caller's team won
    v_winner_side := v_participant.team_side;
  ELSIF (p_result = 'LOSS' AND v_opponent_result = 'WIN') THEN
    -- Agreement: opponent's team won
    v_winner_side := CASE WHEN v_participant.team_side = 'A' THEN 'B' ELSE 'A' END;
  ELSE
    -- Conflict: both claim WIN or both claim LOSS -> dispute
    -- matches has no updated_at column
    UPDATE matches SET status = 'disputed' WHERE id = p_match_id;

    -- Create dispute record if match_results table exists for this purpose
    INSERT INTO match_results (match_id, status, team_a_result, team_b_result)
    VALUES (
      p_match_id,
      'disputed',
      CASE WHEN v_participant.team_side = 'A' THEN p_result ELSE v_opponent_result END,
      CASE WHEN v_participant.team_side = 'B' THEN p_result ELSE v_opponent_result END
    )
    ON CONFLICT (match_id) DO UPDATE SET
      status = 'disputed',
      team_a_result = EXCLUDED.team_a_result,
      team_b_result = EXCLUDED.team_b_result,
      updated_at = now();

    RETURN jsonb_build_object('success', true, 'status', 'disputed', 'message', 'Risultati in conflitto. Un admin esaminerà il match.');
  END IF;

  -- Agreement reached - finalize match and process payout
  SELECT public.finalize_match_payout(p_match_id, v_winner_side) INTO v_finalize_result;

  -- Check if finalize succeeded
  IF v_finalize_result IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Finalize returned null', 'status', 'finalize_failed');
  END IF;

  IF NOT COALESCE((v_finalize_result->>'success')::boolean, false) THEN
    -- Finalize failed - return the error to the frontend
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_finalize_result->>'error', 'Unknown finalize error'),
      'status', 'finalize_failed',
      'message', 'Errore durante la finalizzazione del match. Contatta il supporto.'
    );
  END IF;

  -- Success!
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

-- 2) expire_stale_matches: keep logic identical, only remove matches.updated_at writes
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
  -- Find all matches that have expired but are still open or in ready_check
  FOR v_match IN 
    SELECT m.*
    FROM matches m
    WHERE m.status IN ('open', 'ready_check', 'joined', 'full')
      AND m.expires_at < now()
  LOOP
    RAISE NOTICE '[expire_stale_matches] Processing match % (status: %, expires_at: %)', 
      v_match.id, v_match.status, v_match.expires_at;

    -- Process refunds based on team size
    IF v_match.team_size = 1 THEN
      -- 1v1: refund each participant directly
      FOR v_participant IN
        SELECT mp.user_id, mp.team_side
        FROM match_participants mp
        WHERE mp.match_id = v_match.id
      LOOP
        UPDATE wallets
        SET balance = balance + v_match.entry_fee,
            locked_balance = locked_balance - v_match.entry_fee
        WHERE user_id = v_participant.user_id
          AND locked_balance >= v_match.entry_fee;

        IF FOUND THEN
          INSERT INTO transactions (user_id, type, amount, match_id, description)
          VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                  'Match expired - automatic refund');
          v_refunded_total := v_refunded_total + v_match.entry_fee;
        END IF;
      END LOOP;
    ELSE
      -- Team match: Team A refund using payment_mode_host
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
          UPDATE wallets
          SET balance = balance + v_refund_amount,
              locked_balance = locked_balance - v_refund_amount
          WHERE user_id = v_captain_id AND locked_balance >= v_refund_amount;

          IF FOUND THEN
            INSERT INTO transactions (user_id, type, amount, match_id, description)
            VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 
                    'Match expired - captain refund (cover mode)');
            v_refunded_total := v_refunded_total + v_refund_amount;
          END IF;
        END IF;
      ELSE
        -- Split mode: refund each Team A member
        FOR v_participant IN
          SELECT mp.user_id FROM match_participants mp
          WHERE mp.match_id = v_match.id AND mp.team_side = 'A'
        LOOP
          UPDATE wallets
          SET balance = balance + v_match.entry_fee,
              locked_balance = locked_balance - v_match.entry_fee
          WHERE user_id = v_participant.user_id AND locked_balance >= v_match.entry_fee;

          IF FOUND THEN
            INSERT INTO transactions (user_id, type, amount, match_id, description)
            VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                    'Match expired - automatic refund (split mode)');
            v_refunded_total := v_refunded_total + v_match.entry_fee;
          END IF;
        END LOOP;
      END IF;

      -- Team B refund using payment_mode_joiner (if joined)
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
            UPDATE wallets
            SET balance = balance + v_refund_amount,
                locked_balance = locked_balance - v_refund_amount
            WHERE user_id = v_captain_id AND locked_balance >= v_refund_amount;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 
                      'Match expired - captain refund (cover mode)');
              v_refunded_total := v_refunded_total + v_refund_amount;
            END IF;
          END IF;
        ELSE
          -- Split mode: refund each Team B member
          FOR v_participant IN
            SELECT mp.user_id FROM match_participants mp
            WHERE mp.match_id = v_match.id AND mp.team_side = 'B'
          LOOP
            UPDATE wallets
            SET balance = balance + v_match.entry_fee,
                locked_balance = locked_balance - v_match.entry_fee
            WHERE user_id = v_participant.user_id AND locked_balance >= v_match.entry_fee;

            IF FOUND THEN
              INSERT INTO transactions (user_id, type, amount, match_id, description)
              VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                      'Match expired - automatic refund (split mode)');
              v_refunded_total := v_refunded_total + v_match.entry_fee;
            END IF;
          END LOOP;
        END IF;
      END IF;
    END IF;

    -- Update match status to expired
    -- matches has no updated_at column
    UPDATE matches SET status = 'expired' WHERE id = v_match.id;
    v_expired_count := v_expired_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expired_count', v_expired_count,
    'refunded_total', v_refunded_total,
    'processed_at', now()
  );
END;
$$;
-- Add public match details + unified join wrapper + team member listing

-- =========================================================
-- 1) Public match details (for non-participants)
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_match_public_details(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match jsonb;
  v_creator jsonb;
  v_participant_count integer;
  v_max_participants integer;
BEGIN
  -- Match row
  SELECT to_jsonb(m.*) INTO v_match
  FROM public.matches m
  WHERE m.id = p_match_id;

  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Creator safe fields
  SELECT to_jsonb(row)
  INTO v_creator
  FROM (
    SELECT p.user_id, p.username, p.avatar_url, p.epic_username
    FROM public.profiles p
    WHERE p.user_id = (v_match->>'creator_id')::uuid
  ) row;

  -- Participant counts only (avoid exposing identities in public view)
  SELECT count(*) INTO v_participant_count
  FROM public.match_participants mp
  WHERE mp.match_id = p_match_id;

  v_max_participants := ((v_match->>'team_size')::int) * 2;

  RETURN jsonb_build_object(
    'success', true,
    'match', v_match || jsonb_build_object(
      'creator', v_creator,
      'participants', jsonb_build_array(),
      'participant_count', v_participant_count,
      'max_participants', v_max_participants
    )
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- =========================================================
-- 2) Unified join wrapper (single source of truth for UI)
--    - Uses auth.uid() only
--    - Calls existing stable functions
--    - Normalizes response into {success, reason_code, message, ...}
--    - Enforces team join authority: owner only
-- =========================================================
CREATE OR REPLACE FUNCTION public.join_match(
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
  v_user_id uuid := auth.uid();
  v_match public.matches%ROWTYPE;
  v_inner jsonb;
  v_err text;
  v_status text;
  v_reason text;
  v_message text;
  v_is_owner boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'NOT_AUTHENTICATED', 'message', 'Not authenticated');
  END IF;

  SELECT * INTO v_match FROM public.matches WHERE id = p_match_id;
  IF v_match IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'MATCH_NOT_FOUND', 'message', 'Match not found');
  END IF;

  -- If this is a team match, require team_id
  IF v_match.team_size > 1 AND p_team_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'TEAM_REQUIRED', 'message', 'Team is required for this match');
  END IF;

  -- Enforce owner-only authority for team join
  IF v_match.team_size > 1 THEN
    SELECT (t.owner_id = v_user_id) INTO v_is_owner
    FROM public.teams t
    WHERE t.id = p_team_id;

    IF NOT COALESCE(v_is_owner, false) THEN
      RETURN jsonb_build_object('success', false, 'reason_code', 'TEAM_OWNER_ONLY', 'message', 'Only the team owner can join this match');
    END IF;
  END IF;

  -- Delegate to existing stable join functions
  IF v_match.team_size = 1 THEN
    SELECT public.join_match_v2(p_match_id) INTO v_inner;
  ELSE
    SELECT public.join_team_match(p_match_id, p_team_id, p_payment_mode) INTO v_inner;
  END IF;

  IF v_inner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason_code', 'UNKNOWN', 'message', 'Join returned null');
  END IF;

  IF COALESCE((v_inner->>'success')::boolean, false) THEN
    RETURN v_inner || jsonb_build_object('reason_code', 'OK');
  END IF;

  v_err := COALESCE(v_inner->>'error', 'Unknown error');
  v_status := COALESCE(v_inner->>'status', '');

  -- Normalize reason codes (best-effort mapping to stable UI messages)
  v_reason := 'UNKNOWN';

  IF v_status IN ('match_full', 'full') OR v_err ILIKE '%full%' THEN
    v_reason := 'MATCH_FULL';
  ELSIF v_status IN ('match_not_open', 'not_open') OR v_err ILIKE '%not open%' OR v_err ILIKE '%not joinable%' THEN
    v_reason := 'MATCH_NOT_JOINABLE';
  ELSIF v_status IN ('insufficient_balance', 'insufficient_funds') OR v_err ILIKE '%insufficient%' OR v_err ILIKE '%balance%' THEN
    v_reason := 'INSUFFICIENT_BALANCE';
  ELSIF v_status IN ('already_in_match', 'active_match') OR v_err ILIKE '%already%' AND v_err ILIKE '%match%' THEN
    v_reason := 'ALREADY_IN_ACTIVE_MATCH';
  ELSIF v_status IN ('team_invalid', 'team_size_invalid') OR v_err ILIKE '%team%' AND v_err ILIKE '%eligible%' THEN
    v_reason := 'TEAM_INVALID';
  ELSIF v_err ILIKE '%owner%' AND v_err ILIKE '%only%' THEN
    v_reason := 'TEAM_OWNER_ONLY';
  END IF;

  v_message := COALESCE(v_inner->>'message', v_err);

  RETURN v_inner || jsonb_build_object('reason_code', v_reason, 'message', v_message);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'reason_code', 'EXCEPTION', 'message', SQLERRM);
END;
$$;

-- =========================================================
-- 3) Team members listing (public safe fields only)
--    NOTE: Public member list was requested. This function exposes
--    only non-sensitive profile fields.
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_team_members(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_members jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(row) ORDER BY row.role, row.created_at), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT
      tm.user_id,
      tm.team_id,
      tm.role,
      tm.status,
      tm.created_at,
      p.username,
      p.avatar_url,
      p.epic_username
    FROM public.team_members tm
    LEFT JOIN public.profiles p
      ON p.user_id = tm.user_id
    WHERE tm.team_id = p_team_id
  ) row;

  RETURN jsonb_build_object('success', true, 'members', v_members);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;-- Patch: Fix false positives in team member active-match check (join_team_match + both create_team_match overloads)

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

    INSERT INTO transactions (user_id, type, amount, description, reference_id)
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

      INSERT INTO transactions (user_id, type, amount, description, reference_id)
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


CREATE OR REPLACE FUNCTION public.create_team_match(
  p_team_id uuid,
  p_entry_fee numeric,
  p_region text,
  p_platform text,
  p_mode text,
  p_team_size integer,
  p_first_to integer DEFAULT 3,
  p_payment_mode text DEFAULT 'cover'::text,
  p_is_private boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID := auth.uid();
  v_match_id UUID;
  v_team RECORD;
  v_member RECORD;
  v_accepted_members UUID[];
  v_share NUMERIC;
  v_expires_at TIMESTAMPTZ;
  v_ghost record;
  v_block record;
  v_active_count integer;
BEGIN
  -- Validate team ownership
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF v_team IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  IF v_team.owner_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only team owner can create match');
  END IF;

  -- Get accepted members
  SELECT array_agg(user_id) INTO v_accepted_members
  FROM team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  IF v_accepted_members IS NULL OR array_length(v_accepted_members, 1) < p_team_size THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Team needs %s accepted members, has %s', p_team_size, COALESCE(array_length(v_accepted_members, 1), 0)));
  END IF;

  -- Check no member has active match (STRICT)
  FOR v_member IN
    SELECT tm.user_id, p.username
    FROM team_members tm
    JOIN profiles p ON p.user_id = tm.user_id
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LIMIT p_team_size
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

      RAISE LOG '[create_team_match ghost-clean] member=% match_id=%', v_member.user_id, v_ghost.match_id;
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

      RAISE LOG '[create_team_match busy-check] member=% match_id=% match_status=% participant_status=% expires_at=% finished_at=% created_at=%',
        v_member.user_id,
        v_block.match_id,
        v_block.match_status,
        v_block.participant_status,
        v_block.expires_at,
        v_block.finished_at,
        v_block.created_at;

      RETURN jsonb_build_object('success', false, 'error',
        format('Member %s already has an active match', v_member.username));
    END IF;
  END LOOP;

  -- Calculate share per member
  v_share := CASE WHEN p_payment_mode = 'split' THEN p_entry_fee / p_team_size ELSE p_entry_fee END;
  v_expires_at := now() + interval '30 minutes';

  -- Create match with captain_a_user_id set to caller (team owner)
  INSERT INTO matches (
    creator_id, game, region, platform, mode, team_size, first_to,
    entry_fee, is_private, status, expires_at, team_a_id, payment_mode_host,
    captain_a_user_id
  ) VALUES (
    v_caller_id, 'Fortnite', p_region, p_platform, p_mode, p_team_size, p_first_to,
    p_entry_fee, p_is_private, 'open', v_expires_at, p_team_id, p_payment_mode,
    v_caller_id
  ) RETURNING id INTO v_match_id;

  -- Lock funds and add participants
  FOR v_member IN
    SELECT tm.user_id
    FROM team_members tm
    WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    ORDER BY CASE WHEN tm.user_id = v_caller_id THEN 0 ELSE 1 END, tm.created_at
    LIMIT p_team_size
  LOOP
    IF p_payment_mode = 'cover' THEN
      -- Owner pays all
      IF v_member.user_id = v_caller_id THEN
        UPDATE wallets SET balance = balance - p_entry_fee, locked_balance = locked_balance + p_entry_fee
        WHERE user_id = v_caller_id AND balance >= p_entry_fee;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Insufficient balance';
        END IF;
        INSERT INTO transactions (user_id, type, amount, description, match_id, status)
        VALUES (v_caller_id, 'lock', p_entry_fee, 'Entry fee locked (cover all)', v_match_id, 'completed');
      END IF;
    ELSE
      -- Split payment
      UPDATE wallets SET balance = balance - v_share, locked_balance = locked_balance + v_share
      WHERE user_id = v_member.user_id AND balance >= v_share;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Member has insufficient balance';
      END IF;
      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_member.user_id, 'lock', v_share, 'Entry fee locked (split)', v_match_id, 'completed');
    END IF;

    INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
    VALUES (v_match_id, v_member.user_id, p_team_id, 'A', 'joined');
  END LOOP;

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id);
END;
$function$;


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

    -- Record single transaction for owner
    INSERT INTO transactions (user_id, type, amount, description, reference_id)
    VALUES (v_caller_id, 'lock', v_total_lock, 'Match entry locked (covering team)', NULL);

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

      INSERT INTO transactions (user_id, type, amount, description)
      VALUES (v_member.user_id, 'lock', v_member_share, 'Match entry locked (split)');
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

  -- 7. Update transaction references
  UPDATE transactions
  SET reference_id = v_match_id
  WHERE reference_id IS NULL
    AND type = 'lock'
    AND user_id IN (SELECT user_id FROM match_participants WHERE match_id = v_match_id);

  RETURN jsonb_build_object('success', true, 'match_id', v_match_id);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;
-- Enable required extensions for scheduled function invocations
-- Note: extensions are created in the database; no app code changes required.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
