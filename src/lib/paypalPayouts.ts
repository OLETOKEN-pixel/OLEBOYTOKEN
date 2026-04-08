import type { WithdrawalDestinationSnapshot } from '@/types';

export const PAYPAL_PAYOUT_CURRENCY = 'eur';
export const MIN_PAYPAL_WITHDRAWAL = 9;
export const PAYPAL_WITHDRAWAL_FEE = 0.5;

export function isValidPayPalEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function describePayPalDestination(
  snapshot?: WithdrawalDestinationSnapshot | null,
  fallbackEmail?: string | null
) {
  if (snapshot?.type === 'paypal' && snapshot.email) {
    return snapshot.email;
  }

  if (fallbackEmail) {
    return fallbackEmail;
  }

  return 'Saved PayPal email';
}
