CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_stripe_session_id_unique
ON public.transactions (stripe_session_id)
WHERE stripe_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.credit_stripe_checkout_session(
  p_user_id UUID,
  p_session_id TEXT,
  p_coins NUMERIC,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx_id UUID;
  v_wallet_balance NUMERIC;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Missing user id';
  END IF;

  IF p_session_id IS NULL OR btrim(p_session_id) = '' THEN
    RAISE EXCEPTION 'Missing Stripe session id';
  END IF;

  IF p_coins IS NULL OR p_coins <= 0 THEN
    RAISE EXCEPTION 'Invalid coin amount';
  END IF;

  INSERT INTO public.wallets (user_id, balance, locked_balance)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    description,
    stripe_session_id,
    provider,
    status
  )
  VALUES (
    p_user_id,
    'deposit',
    ROUND(p_coins::NUMERIC, 2),
    COALESCE(p_description, 'Purchased ' || ROUND(p_coins::NUMERIC, 2)::TEXT || ' Coins via Stripe'),
    p_session_id,
    'stripe',
    'completed'
  )
  ON CONFLICT (stripe_session_id) WHERE stripe_session_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_tx_id;

  IF v_tx_id IS NULL THEN
    SELECT balance INTO v_wallet_balance
    FROM public.wallets
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'already_credited', true,
      'session_id', p_session_id,
      'balance', COALESCE(v_wallet_balance, 0)
    );
  END IF;

  UPDATE public.wallets
  SET balance = ROUND((balance + p_coins)::NUMERIC, 2),
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING balance INTO v_wallet_balance;

  RETURN jsonb_build_object(
    'success', true,
    'credited', true,
    'transaction_id', v_tx_id,
    'session_id', p_session_id,
    'coins', ROUND(p_coins::NUMERIC, 2),
    'balance', COALESCE(v_wallet_balance, 0)
  );
END;
$$;
