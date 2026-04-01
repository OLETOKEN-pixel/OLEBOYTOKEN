import Stripe from "https://esm.sh/stripe@14.21.0";

export const STRIPE_PAYOUT_CURRENCY = "eur";
export const MIN_STRIPE_WITHDRAWAL = 10;
export const STRIPE_WITHDRAWAL_FEE = 0.5;

export const SUPPORTED_STRIPE_PAYOUT_COUNTRIES = new Set([
  "AT",
  "AU",
  "BE",
  "BG",
  "BR",
  "CA",
  "CH",
  "CY",
  "CZ",
  "DE",
  "DK",
  "EE",
  "ES",
  "FI",
  "FR",
  "GB",
  "GR",
  "HK",
  "HR",
  "HU",
  "IE",
  "IT",
  "JP",
  "LT",
  "LU",
  "LV",
  "MT",
  "MX",
  "NL",
  "NO",
  "NZ",
  "PL",
  "PT",
  "RO",
  "SE",
  "SG",
  "SI",
  "SK",
  "TH",
  "US",
]);

export function normalizeStripeCountryCode(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  return normalized;
}

export function isSupportedStripePayoutCountry(value: unknown) {
  const normalized = normalizeStripeCountryCode(value);
  return normalized !== null && SUPPORTED_STRIPE_PAYOUT_COUNTRIES.has(normalized);
}

type ExpandableExternalAccounts = Stripe.ApiList<Stripe.BankAccount | Stripe.Card> | undefined;

export function extractExternalAccounts(account: Stripe.Account) {
  const externalAccounts = account.external_accounts as ExpandableExternalAccounts;
  return externalAccounts?.data ?? [];
}

export function buildExternalAccountSnapshot(account: Stripe.Account) {
  const externalAccounts = extractExternalAccounts(account);
  const preferred =
    externalAccounts.find((item) => "default_for_currency" in item && item.default_for_currency) ??
    externalAccounts[0];

  if (!preferred) {
    return null;
  }

  if (preferred.object === "card") {
    return {
      type: "card",
      brand: preferred.brand ?? null,
      country: preferred.country ?? null,
      currency: preferred.currency ?? null,
      last4: preferred.last4 ?? null,
      default_for_currency: preferred.default_for_currency ?? null,
    };
  }

  return {
    type: "bank_account",
    bank_name: preferred.bank_name ?? null,
    country: preferred.country ?? null,
    currency: preferred.currency ?? null,
    last4: preferred.last4 ?? null,
    default_for_currency: preferred.default_for_currency ?? null,
  };
}

export function listExternalAccountTypes(account: Stripe.Account) {
  const types = new Set<string>();

  for (const externalAccount of extractExternalAccounts(account)) {
    if (externalAccount.object === "card") {
      types.add("card");
    } else if (externalAccount.object === "bank_account") {
      types.add("bank_account");
    }
  }

  return Array.from(types);
}

export function getStripePayoutStatus(account: Stripe.Account, externalAccountPresent: boolean) {
  const requirementsDue = account.requirements?.currently_due ?? [];
  const requirementsPendingVerification = account.requirements?.pending_verification ?? [];
  const payoutsEnabled = account.payouts_enabled ?? false;
  const detailsSubmitted = account.details_submitted ?? false;

  if (payoutsEnabled && externalAccountPresent) {
    return "enabled";
  }

  if (!detailsSubmitted && !externalAccountPresent) {
    return "missing";
  }

  if (requirementsDue.length > 0 || requirementsPendingVerification.length > 0) {
    return "restricted";
  }

  if (detailsSubmitted || externalAccountPresent) {
    return "pending";
  }

  return "disabled";
}
