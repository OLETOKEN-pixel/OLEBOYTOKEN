-- Level progression system
-- Levels 0-4: 100 XP each | Level 5+: 200 XP each
-- Each level-up awards 0.50 OBC to wallet (idempotent)

-- Idempotency table: one row per user per level earned
CREATE TABLE IF NOT EXISTS public.user_level_rewards (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level       INT  NOT NULL,
  rewarded_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
ALTER TABLE public.user_level_rewards ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_level_rewards TO authenticated;

-- Pure SQL level formula (mirrors src/lib/xp.ts)
CREATE OR REPLACE FUNCTION public.xp_to_level(p_xp INT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_xp < 500 THEN p_xp / 100
    ELSE 5 + (p_xp - 500) / 200
  END;
$$;

-- Trigger function: fires after every XP increase
CREATE OR REPLACE FUNCTION public.handle_xp_level_up()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_old_level INT;
  v_new_level INT;
  v_l         INT;
BEGIN
  v_old_level := public.xp_to_level(OLD.total_xp);
  v_new_level := public.xp_to_level(NEW.total_xp);

  IF v_new_level > v_old_level THEN
    FOR v_l IN (v_old_level + 1)..v_new_level LOOP
      -- Insert idempotency record; skip if already rewarded
      INSERT INTO public.user_level_rewards (user_id, level)
      VALUES (NEW.user_id, v_l)
      ON CONFLICT (user_id, level) DO NOTHING;

      IF FOUND THEN
        -- Credit 0.50 OBC to wallet
        UPDATE public.wallets
        SET balance = balance + 0.50, updated_at = now()
        WHERE user_id = NEW.user_id;

        -- Log transaction for transparency
        INSERT INTO public.transactions (user_id, type, amount, description, status)
        VALUES (NEW.user_id, 'payout', 0.50, 'Level up: Level ' || v_l, 'completed');
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to user_xp table (only fires when XP increases)
DROP TRIGGER IF EXISTS on_xp_level_up ON public.user_xp;
CREATE TRIGGER on_xp_level_up
AFTER UPDATE ON public.user_xp
FOR EACH ROW
WHEN (NEW.total_xp > OLD.total_xp)
EXECUTE FUNCTION public.handle_xp_level_up();
