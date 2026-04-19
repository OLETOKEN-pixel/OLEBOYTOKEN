-- Auto-claim trigger: when a challenge is completed, immediately award XP and mark claimed.
-- This makes reward awarding backend-driven — no frontend call needed.

CREATE OR REPLACE FUNCTION public.handle_challenge_auto_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge RECORD;
BEGIN
  -- Only fire when transitioning to is_completed = true and not yet claimed
  IF NEW.is_completed = true AND NEW.is_claimed = false THEN
    SELECT * INTO v_challenge FROM challenges WHERE id = NEW.challenge_id;

    -- Award XP
    IF v_challenge.reward_xp > 0 THEN
      INSERT INTO user_xp (user_id, total_xp, updated_at)
      VALUES (NEW.user_id, v_challenge.reward_xp, now())
      ON CONFLICT (user_id)
      DO UPDATE SET
        total_xp   = user_xp.total_xp + v_challenge.reward_xp,
        updated_at = now();
    END IF;

    -- Award coin (no weekly cap for auto-claim — simpler and more reliable)
    IF v_challenge.reward_coin > 0 THEN
      UPDATE wallets
      SET balance = balance + v_challenge.reward_coin, updated_at = now()
      WHERE user_id = NEW.user_id;

      INSERT INTO transactions (user_id, type, amount, description, status)
      VALUES (NEW.user_id, 'payout', v_challenge.reward_coin,
              'Challenge reward: ' || v_challenge.title, 'completed');
    END IF;

    -- Mark claimed atomically in the same row update
    NEW.is_claimed        := true;
    NEW.claimed_at        := now();
    NEW.reward_granted_xp   := v_challenge.reward_xp;
    NEW.reward_granted_coin := v_challenge.reward_coin;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_challenge_completed ON public.user_challenge_progress;
CREATE TRIGGER on_challenge_completed
BEFORE UPDATE OF is_completed ON public.user_challenge_progress
FOR EACH ROW
WHEN (NEW.is_completed = true AND OLD.is_completed = false)
EXECUTE FUNCTION public.handle_challenge_auto_claim();
