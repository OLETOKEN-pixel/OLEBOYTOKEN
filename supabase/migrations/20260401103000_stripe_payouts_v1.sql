-- Stripe Connect Payouts v1
-- Extends payout accounting for request-driven Stripe Connect withdrawals.

ALTER TABLE public.stripe_connected_accounts
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS details_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS payouts_status TEXT DEFAULT 'missing',
ADD COLUMN IF NOT EXISTS requirements_pending_verification JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS external_account_present BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS external_account_types JSONB DEFAULT '[]'::jsonb;

UPDATE public.stripe_connected_accounts
SET country = COALESCE(country, 'IT')
WHERE stripe_account_id IS NOT NULL
  AND country IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stripe_connected_accounts_payouts_status_check'
      AND conrelid = 'public.stripe_connected_accounts'::regclass
  ) THEN
    ALTER TABLE public.stripe_connected_accounts
    ADD CONSTRAINT stripe_connected_accounts_payouts_status_check
    CHECK (payouts_status IN ('missing', 'pending', 'enabled', 'restricted', 'disabled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_stripe_connected_accounts_country
ON public.stripe_connected_accounts(country);

ALTER TABLE public.withdrawal_requests
ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(10,2) NOT NULL DEFAULT 0.50,
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'eur',
ADD COLUMN IF NOT EXISTS stripe_transfer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_payout_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_transfer_reversal_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_error_code TEXT,
ADD COLUMN IF NOT EXISTS stripe_error_message TEXT,
ADD COLUMN IF NOT EXISTS payout_destination_snapshot JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

DO $$
BEGIN
  ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_payment_method_check;
  ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
END $$;

ALTER TABLE public.withdrawal_requests
ADD CONSTRAINT withdrawal_requests_payment_method_check
CHECK (payment_method IN ('paypal', 'bank', 'stripe'));

ALTER TABLE public.withdrawal_requests
ADD CONSTRAINT withdrawal_requests_status_check
CHECK (status IN ('pending', 'processing', 'approved', 'rejected', 'failed', 'completed'));

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_transaction_id
ON public.withdrawal_requests(transaction_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_stripe_transfer_id
ON public.withdrawal_requests(stripe_transfer_id)
WHERE stripe_transfer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_stripe_payout_id
ON public.withdrawal_requests(stripe_payout_id)
WHERE stripe_payout_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
ON public.withdrawal_requests(status);

CREATE OR REPLACE FUNCTION public.create_stripe_withdrawal_request(
  p_user_id UUID,
  p_amount NUMERIC,
  p_fee_amount NUMERIC DEFAULT 0.50,
  p_currency TEXT DEFAULT 'eur',
  p_payment_details TEXT DEFAULT 'stripe',
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
    format('Withdrawal request €%s (+ €%s fee)', to_char(p_amount, 'FM999999990.00'), to_char(p_fee_amount, 'FM999999990.00')),
    'stripe',
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
    'stripe',
    COALESCE(p_payment_details, 'stripe'),
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

CREATE OR REPLACE FUNCTION public.sync_stripe_withdrawal_request(
  p_withdrawal_id UUID,
  p_status TEXT,
  p_restore_funds BOOLEAN DEFAULT false,
  p_stripe_transfer_id TEXT DEFAULT NULL,
  p_stripe_payout_id TEXT DEFAULT NULL,
  p_stripe_transfer_reversal_id TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
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
  END IF;

  UPDATE public.withdrawal_requests
  SET status = p_status,
      stripe_transfer_id = COALESCE(p_stripe_transfer_id, stripe_transfer_id),
      stripe_payout_id = COALESCE(p_stripe_payout_id, stripe_payout_id),
      stripe_transfer_reversal_id = COALESCE(p_stripe_transfer_reversal_id, stripe_transfer_reversal_id),
      stripe_error_code = CASE WHEN p_status = 'failed' THEN p_error_code ELSE NULL END,
      stripe_error_message = CASE WHEN p_status = 'failed' THEN p_error_message ELSE NULL END,
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
          format('Withdrawal request failed: %s', left(p_error_message, 180))
        WHEN p_status = 'completed' THEN
          format(
            'Withdrawal completed €%s (+ €%s fee)',
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
    'restored_funds', p_restore_funds AND v_request.status <> 'failed'
  );
END;
$$;
