import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  buildExternalAccountSnapshot,
  getStripePayoutStatus,
  listExternalAccountTypes,
  normalizeStripeCountryCode,
} from "./stripe-payout-config.ts";

type SupabaseAdminClient = ReturnType<typeof createClient>;

export async function ensureManualPayoutSchedule(stripe: Stripe, stripeAccountId: string) {
  await stripe.accounts.update(stripeAccountId, {
    settings: {
      payouts: {
        schedule: {
          interval: "manual",
        },
      },
    },
  });
}

export async function syncConnectedAccountState(
  supabase: SupabaseAdminClient,
  userId: string,
  account: Stripe.Account,
  fallbackCountry?: string | null
) {
  const externalSnapshot = buildExternalAccountSnapshot(account);
  const externalAccountPresent = externalSnapshot !== null;
  const country = normalizeStripeCountryCode(account.country) ?? normalizeStripeCountryCode(fallbackCountry);
  const payoutsStatus = getStripePayoutStatus(account, externalAccountPresent);
  const onboardingComplete = (account.payouts_enabled ?? false) && externalAccountPresent;

  const payload = {
    user_id: userId,
    stripe_account_id: account.id,
    country,
    onboarding_complete: onboardingComplete,
    charges_enabled: account.charges_enabled ?? false,
    payouts_enabled: account.payouts_enabled ?? false,
    details_submitted: account.details_submitted ?? false,
    payouts_status: payoutsStatus,
    requirements_due: account.requirements?.currently_due ?? [],
    requirements_pending_verification: account.requirements?.pending_verification ?? [],
    external_account_present: externalAccountPresent,
    external_account_types: listExternalAccountTypes(account),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("stripe_connected_accounts")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    console.error("[STRIPE-CONNECT-SYNC] Failed to persist connected account state", {
      userId,
      stripeAccountId: account.id,
      error,
    });
  }

  return {
    ...payload,
    external_snapshot: externalSnapshot,
  };
}
