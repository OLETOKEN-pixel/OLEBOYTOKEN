-- PayPal Payouts v1
-- Keeps Stripe deposit infrastructure intact while switching user withdrawals to PayPal.

ALTER TABLE public.withdrawal_requests
ADD COLUMN IF NOT EXISTS paypal_batch_id TEXT,
ADD COLUMN IF NOT EXISTS paypal_item_id TEXT,
ADD COLUMN IF NOT EXISTS paypal_item_status TEXT,
ADD COLUMN IF NOT EXISTS paypal_error_name TEXT,
ADD COLUMN IF NOT EXISTS paypal_error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_paypal_batch_id
ON public.withdrawal_requests(paypal_batch_id)
WHERE paypal_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_paypal_item_id
ON public.withdrawal_requests(paypal_item_id)
WHERE paypal_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_paypal_withdrawal_request(
  p_user_id UUID,
  p_amount NUMERIC,
  p_fee_amount NUMERIC DEFAULT 0.50,
  p_currency TEXT DEFAULT 'eur',
  p_payment_details TEXT DEFAULT NULL,
  p_destination_snapshot JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
  v_transaction_id UUID;
  v_withdrawal_id UUID;
  v_total_deduction NUMERIC(10,2);
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing user id');
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  IF p_payment_details IS NULL OR btrim(p_payment_details) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing PayPal email');
  END IF;

  v_total_deduction := ROUND((p_amount + p_fee_amount)::numeric, 2);

  SELECT *
  INTO v_wallet
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  IF COALESCE(v_wallet.balance, 0) < v_total_deduction THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient balance',
      'balance', COALESCE(v_wallet.balance, 0),
      'required', v_total_deduction
    );
  END IF;

  INSERT INTO public.transactions (
    user_id,
    type,
    amount,
    description,
    provider,
    status
  )
  VALUES (
    p_user_id,
    'payout',
    -v_total_deduction,
    format(
      'PayPal withdrawal request €%s (+ €%s fee)',
      to_char(p_amount, 'FM999999990.00'),
      to_char(p_fee_amount, 'FM999999990.00')
    ),
    'paypal',
    'pending'
  )
  RETURNING id INTO v_transaction_id;

  UPDATE public.wallets
  SET balance = balance - v_total_deduction,
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.withdrawal_requests (
    user_id,
    amount,
    payment_method,
    payment_details,
    status,
    fee_amount,
    currency,
    payout_destination_snapshot,
    transaction_id
  )
  VALUES (
    p_user_id,
    ROUND(p_amount::numeric, 2),
    'paypal',
    btrim(p_payment_details),
    'pending',
    ROUND(p_fee_amount::numeric, 2),
    lower(COALESCE(p_currency, 'eur')),
    COALESCE(p_destination_snapshot, '{}'::jsonb),
    v_transaction_id
  )
  RETURNING id INTO v_withdrawal_id;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'transaction_id', v_transaction_id,
    'new_balance', ROUND((v_wallet.balance - v_total_deduction)::numeric, 2),
    'total_deduction', v_total_deduction
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_paypal_withdrawal_request(
  p_withdrawal_id UUID,
  p_status TEXT,
  p_restore_funds BOOLEAN DEFAULT false,
  p_paypal_batch_id TEXT DEFAULT NULL,
  p_paypal_item_id TEXT DEFAULT NULL,
  p_paypal_item_status TEXT DEFAULT NULL,
  p_error_name TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_total_deduction NUMERIC(10,2);
  v_restored_funds BOOLEAN := false;
BEGIN
  IF p_withdrawal_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Missing withdrawal id');
  END IF;

  IF p_status NOT IN ('pending', 'processing', 'approved', 'rejected', 'failed', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT *
  INTO v_request
  FROM public.withdrawal_requests
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  IF v_request.status = 'completed' AND p_status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  IF v_request.status = 'failed' AND p_status = 'failed' THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  IF v_request.status = 'completed' AND p_status <> 'completed' THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'reason', 'already_completed');
  END IF;

  IF v_request.status = 'failed' AND p_status <> 'failed' THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'reason', 'already_failed');
  END IF;

  IF v_request.status = 'processing' AND p_status = 'pending' THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'reason', 'already_processing');
  END IF;

  v_total_deduction := ROUND((COALESCE(v_request.amount, 0) + COALESCE(v_request.fee_amount, 0))::numeric, 2);

  IF p_restore_funds AND v_request.status <> 'failed' THEN
    UPDATE public.wallets
    SET balance = balance + v_total_deduction,
        updated_at = now()
    WHERE user_id = v_request.user_id;

    v_restored_funds := true;
  END IF;

  UPDATE public.withdrawal_requests
  SET status = p_status,
      paypal_batch_id = COALESCE(p_paypal_batch_id, paypal_batch_id),
      paypal_item_id = COALESCE(p_paypal_item_id, paypal_item_id),
      paypal_item_status = COALESCE(p_paypal_item_status, paypal_item_status),
      paypal_error_name = CASE WHEN p_status = 'failed' THEN p_error_name ELSE NULL END,
      paypal_error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE NULL END,
      processed_at = CASE WHEN p_status IN ('failed', 'completed', 'rejected') THEN now() ELSE processed_at END
  WHERE id = p_withdrawal_id;

  IF v_request.transaction_id IS NOT NULL THEN
    UPDATE public.transactions
    SET status = CASE
        WHEN p_status = 'completed' THEN 'completed'
        WHEN p_status = 'failed' THEN 'failed'
        ELSE 'pending'
      END,
      description = CASE
        WHEN p_status = 'failed' AND p_error_message IS NOT NULL AND p_error_message <> '' THEN
          format('PayPal withdrawal failed: %s', left(p_error_message, 180))
        WHEN p_status = 'completed' THEN
          format(
            'PayPal withdrawal completed €%s (+ €%s fee)',
            to_char(v_request.amount, 'FM999999990.00'),
            to_char(COALESCE(v_request.fee_amount, 0), 'FM999999990.00')
          )
        ELSE description
      END
    WHERE id = v_request.transaction_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', p_withdrawal_id,
    'status', p_status,
    'restored_funds', v_restored_funds
  );
END;
$$;
