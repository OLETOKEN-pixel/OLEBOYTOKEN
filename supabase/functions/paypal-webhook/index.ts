import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  extractPayPalBatchId,
  extractPayPalErrorDetails,
  extractPayPalItemId,
  extractPayPalItemStatus,
  getPayPalPayoutItem,
  verifyPayPalWebhookSignature,
} from "../_shared/paypal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const suffix = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[PAYPAL-WEBHOOK] ${step}${suffix}`);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function findWithdrawalRequest(
  supabase: ReturnType<typeof createClient>,
  batchId: string | null,
  itemId: string | null
) {
  if (itemId) {
    const byItem = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("paypal_item_id", itemId)
      .maybeSingle();

    if (byItem.error) {
      throw byItem.error;
    }

    if (byItem.data) {
      return byItem.data;
    }
  }

  if (batchId) {
    const byBatch = await supabase
      .from("withdrawal_requests")
      .select("*")
      .eq("paypal_batch_id", batchId)
      .maybeSingle();

    if (byBatch.error) {
      throw byBatch.error;
    }

    return byBatch.data;
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rawBody = await req.text();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const webhookId = Deno.env.get("PAYPAL_WEBHOOK_ID");
    const missingEnv = [
      !supabaseUrl ? "SUPABASE_URL" : null,
      !serviceRoleKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
      !webhookId ? "PAYPAL_WEBHOOK_ID" : null,
      !Deno.env.get("PAYPAL_CLIENT_ID") ? "PAYPAL_CLIENT_ID" : null,
      !Deno.env.get("PAYPAL_CLIENT_SECRET") ? "PAYPAL_CLIENT_SECRET" : null,
      !Deno.env.get("PAYPAL_ENV") ? "PAYPAL_ENV" : null,
    ].filter((value): value is string => Boolean(value));

    if (missingEnv.length > 0) {
      return jsonResponse(
        {
          error: "PayPal webhook is not configured.",
          details: `Missing environment variables: ${missingEnv.join(", ")}`,
        },
        503
      );
    }

    const event = JSON.parse(rawBody) as Record<string, unknown>;
    const transmissionId = req.headers.get("paypal-transmission-id");
    const transmissionTime = req.headers.get("paypal-transmission-time");
    const transmissionSig = req.headers.get("paypal-transmission-sig");
    const certUrl = req.headers.get("paypal-cert-url");
    const authAlgo = req.headers.get("paypal-auth-algo");

    if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
      return jsonResponse(
        {
          error: "Missing PayPal webhook signature headers.",
        },
        400
      );
    }

    const verified = await verifyPayPalWebhookSignature({
      transmissionId,
      transmissionTime,
      transmissionSig,
      certUrl,
      authAlgo,
      webhookId: webhookId!,
      webhookEvent: event,
    });

    if (!verified) {
      return jsonResponse({ error: "Invalid PayPal webhook signature." }, 400);
    }

    const supabase = createClient(supabaseUrl!, serviceRoleKey!);
    const eventType = typeof event.event_type === "string" ? event.event_type : "unknown";
    let batchId = extractPayPalBatchId(event);
    let itemId = extractPayPalItemId(event);
    let itemStatus = extractPayPalItemStatus(event);
    let errorDetails = extractPayPalErrorDetails(event);

    if (itemId && (!batchId || !itemStatus)) {
      try {
        const payoutItem = await getPayPalPayoutItem(itemId);
        batchId = batchId || extractPayPalBatchId({ resource: payoutItem });
        itemStatus = itemStatus || extractPayPalItemStatus({ resource: payoutItem });
        const enrichedError = extractPayPalErrorDetails({ resource: payoutItem });
        errorDetails = {
          name: errorDetails.name || enrichedError.name,
          message: errorDetails.message || enrichedError.message,
        };
      } catch (lookupError) {
        logStep("Unable to enrich PayPal payout item details", {
          itemId,
          error: lookupError instanceof Error ? lookupError.message : "Unknown lookup error",
        });
      }
    }

    const withdrawalRequest = await findWithdrawalRequest(supabase, batchId, itemId);
    if (!withdrawalRequest) {
      logStep("No withdrawal request found for webhook", { eventType, batchId, itemId });
      return jsonResponse({ received: true });
    }

    logStep("Webhook received", {
      eventType,
      withdrawalId: withdrawalRequest.id,
      batchId,
      itemId,
      itemStatus,
    });

    if (eventType === "PAYMENT.PAYOUTSBATCH.PROCESSING") {
      const { error } = await supabase.rpc("sync_paypal_withdrawal_request", {
        p_withdrawal_id: withdrawalRequest.id,
        p_status: "processing",
        p_restore_funds: false,
        p_paypal_batch_id: batchId,
        p_paypal_item_id: itemId,
        p_paypal_item_status: itemStatus || "PROCESSING",
      });

      if (error) {
        throw error;
      }

      return jsonResponse({ received: true });
    }

    if (
      eventType === "PAYMENT.PAYOUTSBATCH.SUCCESS" ||
      eventType === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED"
    ) {
      const { error } = await supabase.rpc("sync_paypal_withdrawal_request", {
        p_withdrawal_id: withdrawalRequest.id,
        p_status: "completed",
        p_restore_funds: false,
        p_paypal_batch_id: batchId,
        p_paypal_item_id: itemId,
        p_paypal_item_status: itemStatus || "SUCCESS",
      });

      if (error) {
        throw error;
      }

      return jsonResponse({ received: true });
    }

    if (
      eventType === "PAYMENT.PAYOUTSBATCH.DENIED" ||
      eventType === "PAYMENT.PAYOUTS-ITEM.FAILED" ||
      eventType === "PAYMENT.PAYOUTS-ITEM.UNCLAIMED" ||
      eventType === "PAYMENT.PAYOUTS-ITEM.RETURNED" ||
      eventType === "PAYMENT.PAYOUTS-ITEM.REFUNDED"
    ) {
      const { error } = await supabase.rpc("sync_paypal_withdrawal_request", {
        p_withdrawal_id: withdrawalRequest.id,
        p_status: "failed",
        p_restore_funds: true,
        p_paypal_batch_id: batchId,
        p_paypal_item_id: itemId,
        p_paypal_item_status: itemStatus || eventType,
        p_error_name: errorDetails.name || eventType,
        p_error_message: errorDetails.message || `PayPal reported ${eventType}`,
      });

      if (error) {
        throw error;
      }

      return jsonResponse({ received: true });
    }

    return jsonResponse({ received: true, ignored: true, eventType });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    logStep("Webhook handler error", { message, rawBodyPreview: rawBody.slice(0, 500) });
    return jsonResponse({ error: message }, 500);
  }
});
