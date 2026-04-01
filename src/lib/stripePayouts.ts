export const STRIPE_PAYOUT_CURRENCY = 'eur';
export const MIN_STRIPE_WITHDRAWAL = 10;
export const STRIPE_WITHDRAWAL_FEE = 0.5;

export type StripePayoutStatus = 'missing' | 'pending' | 'enabled' | 'restricted' | 'disabled';

export interface StripePayoutCountryOption {
  code: string;
  label: string;
}

export interface WithdrawalDestinationSnapshot {
  type?: 'bank_account' | 'card' | 'unknown';
  brand?: string | null;
  bank_name?: string | null;
  country?: string | null;
  currency?: string | null;
  last4?: string | null;
  default_for_currency?: boolean | null;
}

export const STRIPE_PAYOUT_COUNTRIES: StripePayoutCountryOption[] = [
  { code: 'AT', label: 'Austria' },
  { code: 'AU', label: 'Australia' },
  { code: 'BE', label: 'Belgium' },
  { code: 'BG', label: 'Bulgaria' },
  { code: 'BR', label: 'Brazil' },
  { code: 'CA', label: 'Canada' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'CY', label: 'Cyprus' },
  { code: 'CZ', label: 'Czech Republic' },
  { code: 'DE', label: 'Germany' },
  { code: 'DK', label: 'Denmark' },
  { code: 'EE', label: 'Estonia' },
  { code: 'ES', label: 'Spain' },
  { code: 'FI', label: 'Finland' },
  { code: 'FR', label: 'France' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'GR', label: 'Greece' },
  { code: 'HK', label: 'Hong Kong' },
  { code: 'HR', label: 'Croatia' },
  { code: 'HU', label: 'Hungary' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IT', label: 'Italy' },
  { code: 'JP', label: 'Japan' },
  { code: 'LT', label: 'Lithuania' },
  { code: 'LU', label: 'Luxembourg' },
  { code: 'LV', label: 'Latvia' },
  { code: 'MT', label: 'Malta' },
  { code: 'MX', label: 'Mexico' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'NO', label: 'Norway' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'RO', label: 'Romania' },
  { code: 'SE', label: 'Sweden' },
  { code: 'SG', label: 'Singapore' },
  { code: 'SI', label: 'Slovenia' },
  { code: 'SK', label: 'Slovakia' },
  { code: 'TH', label: 'Thailand' },
  { code: 'US', label: 'United States' },
];

export const STRIPE_PAYOUT_COUNTRY_MAP = new Map(
  STRIPE_PAYOUT_COUNTRIES.map((country) => [country.code, country.label])
);

export function getStripePayoutCountryLabel(code?: string | null) {
  if (!code) {
    return 'Not selected';
  }

  return STRIPE_PAYOUT_COUNTRY_MAP.get(code.toUpperCase()) ?? code.toUpperCase();
}

export function describeStripeDestination(snapshot?: WithdrawalDestinationSnapshot | null) {
  if (!snapshot || !snapshot.type) {
    return 'Stripe managed payout method';
  }

  const suffix = snapshot.last4 ? `•••• ${snapshot.last4}` : '';

  if (snapshot.type === 'card') {
    return [snapshot.brand ? snapshot.brand.toUpperCase() : 'Debit card', suffix].filter(Boolean).join(' ');
  }

  if (snapshot.type === 'bank_account') {
    return [snapshot.bank_name || 'Bank account', suffix].filter(Boolean).join(' ');
  }

  return 'Stripe managed payout method';
}
