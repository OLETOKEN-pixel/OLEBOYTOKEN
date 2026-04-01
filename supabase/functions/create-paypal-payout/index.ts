import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  classifyPayPalPayoutError,
  createPayPalPayout,
  MIN_PAYPAL_WITHDRAWAL,
  PAYPAL_PAYOUT_CURRENCY,
  PAYPAL_WITHDRAWAL_FEE,
} from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-PAYPAL-PAYOUT] ${step}${detailsStr}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const missingEnv = [
      !supabaseUrl ? "SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      !Deno.env.get("PAYPAL_CLIENT_ID") ? "PAYPAL_CLIENT_ID" : null,
      !Deno.env.get("PAYPAL_CLIENT_SECRET") ? "PAYPAL_CLIENT_SECRET" : null,
      !Deno.env.get("PAYPAL_ENV") ? "PAYPAL_ENV" : null,
    ].filter((value): value is string => Boolean(value));

    if (missingEnv.length > 0) {
      return jsonResponse(
        {
          error: "PayPal payouts are not configured.",
          details: `Missing environment variables: ${missingEnv.join(", ")}`,
          code: "PAYPAL_CONFIG_MISSING",
        },
        503
      );
    }

    const supabase = createClient(supabaseUrl!, serviceRoleKey!);
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      return jsonResponse({ error: "Unauthorized", code: "UNAUTHORIZED" }, 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse(
        {
          error: "Unauthorized",
          details: authError?.message ?? null,
          code: "UNAUTHORIZED",
        },
        401
      );
    }

    const body = await req.json();
    const requestedAmount = Number.parseFloat(String(body?.amount ?? ""));
    const amount = Number.isFinite(requestedAmount)
      ? Math.round(requestedAmount * 100) / 100
      : Number.NaN;

    if (!Number.isFinite(amount) || amount < MIN_PAYPAL_WITHDRAWAL) {
      return jsonResponse(
        {
          error: `Minimum withdrawal is €${MIN_PAYPAL_WITHDRAWAL}.`,
          code: "PAYPAL_WITHDRAWAL_MINIMUM",
        },
        400
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("paypal_email")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const paypalEmail = profile?.paypal_email?.trim() ?? "";
    if (!paypalEmail || !isValidEmail(paypalEmail)) {
      return jsonResponse(
        {
          error: "Add a valid PayPal email before requesting a withdrawal.",
          code: "PAYPAL_EMAIL_MISSING",
        },
        400
      );
    }

    const reserveResult = await supabase.rpc("create_paypal_withdrawal_request", {
      p_user_id: user.id,
      p_amount: amount,
      p_fee_amount: PAYPAL_WITHDRAWAL_FEE,
      p_currency: PAYPAL_PAYOUT_CURRENCY.toLowerCase(),
      p_payment_details: paypalEmail,
      p_destination_snapshot: {
        type: "paypal",
        email: paypalEmail,
      },
    });

    if (reserveResult.error) {
      throw reserveResult.error;
    }

    const reservePayload = reserveResult.data as {
      success?: boolean;
      error?: string;
      withdrawal_id?: string;
      new_balance?: number;
    } | null;

    if (!reservePayload?.success || !reservePayload.withdrawal_id) {
      return jsonResponse(
        {
          error: reservePayload?.error || "Unable to reserve wallet funds for the withdrawal.",
          code: "PAYPAL_WITHDRAWAL_RESERVE_FAILED",
        },
        400
      );
    }

    const withdrawalId = reservePayload.withdrawal_id;
    const senderBatchId = `oleboy-wd-${withdrawalId}`;
    const senderItemId = `oleboy-item-${withdrawalId}`;

    try {
      const payout = await createPayPalPayout({
        senderBatchId,
        senderItemId,
        receiverEmail: paypalEmail,
        amount,
        note: "OLEBOY withdrawal",
      });

      if (!payout.batchId) {
        throw new Error("PayPal did not return a payout batch id.");
      }

      const normalizedStatus = (payout.itemStatus || payout.batchStatus || "PENDING").toUpperCase();
      const withdrawalStatus =
        normalizedStatus === "SUCCESS"
          ? "completed"
          : normalizedStatus === "FAILED" ||
              normalizedStatus === "DENIED" ||
              normalizedStatus === "RETURNED" ||
              normalizedStatus === "UNCLAIMED" ||
              normalizedStatus === "REFUNDED"
            ? "failed"
            : "processing";

      const syncResult = await supabase.rpc("sync_paypal_withdrawal_request", {
        p_withdrawal_id: withdrawalId,
        p_status: withdrawalStatus,
        p_restore_funds: withdrawalStatus === "failed",
        p_paypal_batch_id: payout.batchId,
        p_paypal_item_id: payout.itemId,
        p_paypal_item_status: payout.itemStatus || payout.batchStatus,
        p_error_name: withdrawalStatus === "failed" ? "PAYPAL_PAYOUT_REJECTED" : null,
        p_error_message:
          withdrawalStatus === "failed"
            ? "PayPal rejected this payout immediately."
            : null,
      });

      if (syncResult.error) {
        throw syncResult.error;
      }

      return jsonResponse({
        success: true,
        withdrawalId,
        paypalBatchId: payout.batchId,
        paypalItemId: payout.itemId,
        paypalItemStatus: payout.itemStatus,
        status: withdrawalStatus,
        fee: PAYPAL_WITHDRAWAL_FEE,
        amount,
        newBalance: reservePayload.new_balance,
        paypalDebugId: payout.debugId,
      });
    } catch (payoutError) {
      const classified = classifyPayPalPayoutError(
        payoutError,
        "Unable to submit the PayPal payout right now."
      );

      const syncResult = await supabase.rpc("sync_paypal_withdrawal_request", {
        p_withdrawal_id: withdrawalId,
        p_status: "failed",
        p_restore_funds: true,
        p_error_name: classified.code,
        p_error_message: classified.details ?? classified.error,
      });

      if (syncResult.error) {
        logStep("Failed to roll back reserved withdrawal after PayPal error", {
          withdrawalId,
          error: syncResult.error.message,
        });
      }

      return jsonResponse(classified, 400);
    }
  } catch (error) {
    const classified = classifyPayPalPayoutError(
      error,
      "Unable to submit the PayPal payout right now."
    );
    logStep("Unhandled error", classified);
    return jsonResponse(classified, 500);
  }
});
