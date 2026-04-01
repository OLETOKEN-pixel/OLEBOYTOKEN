export const PAYPAL_PAYOUT_CURRENCY = "EUR";
export const MIN_PAYPAL_WITHDRAWAL = 10;
export const PAYPAL_WITHDRAWAL_FEE = 0.5;

type PayPalEnv = "live" | "sandbox";

interface PayPalApiErrorShape {
  name?: string;
  message?: string;
  details?: unknown;
  debug_id?: string;
}

interface PayPalErrorExtra {
  code?: string | null;
  debugId?: string | null;
  details?: string | null;
  status?: number;
}

export interface PayPalPayoutCreateResult {
  batchId: string | null;
  batchStatus: string | null;
  itemId: string | null;
  itemStatus: string | null;
  debugId: string | null;
  raw: Record<string, unknown>;
}

export interface PayPalWebhookVerificationParams {
  transmissionId: string;
  transmissionTime: string;
  transmissionSig: string;
  certUrl: string;
  authAlgo: string;
  webhookId: string;
  webhookEvent: Record<string, unknown>;
}

type PayPalRequestOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown> | string | undefined;
};

type PayPalRequestResult<T> = {
  data: T;
  debugId: string | null;
};

function buildPayPalError(message: string, extra: PayPalErrorExtra = {}) {
  const error = new Error(message) as Error & PayPalErrorExtra;
  error.code = extra.code ?? null;
  error.debugId = extra.debugId ?? null;
  error.details = extra.details ?? null;
  error.status = extra.status;
  return error;
}

function getPayPalEnv(): PayPalEnv {
  return Deno.env.get("PAYPAL_ENV")?.toLowerCase() === "live" ? "live" : "sandbox";
}

function getPayPalApiBase() {
  return getPayPalEnv() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function getPayPalCredentials() {
  const clientId = Deno.env.get("PAYPAL_CLIENT_ID");
  const clientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
  const missingEnv = [
    !clientId ? "PAYPAL_CLIENT_ID" : null,
    !clientSecret ? "PAYPAL_CLIENT_SECRET" : null,
  ].filter((value): value is string => Boolean(value));

  if (missingEnv.length > 0) {
    throw buildPayPalError("PayPal payouts are not configured.", {
      code: "PAYPAL_CONFIG_MISSING",
      details: `Missing environment variables: ${missingEnv.join(", ")}`,
    });
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
  };
}

async function parsePayPalResponse(response: Response) {
  const responseText = await response.text();
  if (!responseText) {
    return null;
  }

  try {
    return JSON.parse(responseText) as Record<string, unknown>;
  } catch {
    return { raw: responseText };
  }
}

function stringifyPayPalDetails(details: unknown) {
  if (typeof details === "string") {
    return details;
  }

  if (!details) {
    return null;
  }

  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}

export async function getPayPalAccessToken() {
  const { clientId, clientSecret } = getPayPalCredentials();
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${getPayPalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  });

  const payload = (await parsePayPalResponse(response)) as
    | (Record<string, unknown> & { access_token?: string })
    | null;
  const debugId = response.headers.get("paypal-debug-id");

  if (!response.ok || !payload?.access_token) {
    const errorPayload = payload as PayPalApiErrorShape | null;
    throw buildPayPalError(errorPayload?.message || "Unable to authenticate with PayPal.", {
      code: errorPayload?.name || "PAYPAL_AUTH_FAILED",
      debugId: errorPayload?.debug_id || debugId,
      details: stringifyPayPalDetails(errorPayload?.details ?? payload),
      status: response.status,
    });
  }

  return {
    accessToken: payload.access_token,
    debugId,
  };
}

export async function paypalRequest<T>(
  path: string,
  options: PayPalRequestOptions = {}
): Promise<PayPalRequestResult<T>> {
  const { accessToken } = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalApiBase()}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    body:
      typeof options.body === "string"
        ? options.body
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
  });

  const payload = (await parsePayPalResponse(response)) as T | PayPalApiErrorShape | null;
  const debugId = response.headers.get("paypal-debug-id");

  if (!response.ok) {
    const errorPayload = payload as PayPalApiErrorShape | null;
    throw buildPayPalError(errorPayload?.message || "PayPal request failed.", {
      code: errorPayload?.name || "PAYPAL_REQUEST_FAILED",
      debugId: errorPayload?.debug_id || debugId,
      details: stringifyPayPalDetails(errorPayload?.details ?? payload),
      status: response.status,
    });
  }

  return {
    data: (payload ?? {}) as T,
    debugId,
  };
}

export async function createPayPalPayout(params: {
  senderBatchId: string;
  senderItemId: string;
  receiverEmail: string;
  amount: number;
  note?: string;
}) {
  const { data, debugId } = await paypalRequest<Record<string, unknown>>("/v1/payments/payouts", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
      "PayPal-Request-Id": params.senderBatchId,
    },
    body: {
      sender_batch_header: {
        sender_batch_id: params.senderBatchId,
        email_subject: "Your OLEBOY payout is on the way",
        email_message: "OLEBOY has sent your withdrawal to your PayPal account.",
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: {
            value: params.amount.toFixed(2),
            currency: PAYPAL_PAYOUT_CURRENCY,
          },
          receiver: params.receiverEmail,
          note: params.note ?? "OLEBOY withdrawal",
          sender_item_id: params.senderItemId,
        },
      ],
    },
  });

  const batchHeader = asRecord((data as Record<string, unknown>).batch_header);
  const items = Array.isArray((data as Record<string, unknown>).items)
    ? ((data as Record<string, unknown>).items as unknown[])
    : [];
  const firstItem = asRecord(items[0]);

  return {
    batchId: readString(batchHeader?.payout_batch_id),
    batchStatus: readString(batchHeader?.batch_status),
    itemId:
      readString(firstItem?.payout_item_id) ||
      readString(asRecord(firstItem?.payout_item)?.payout_item_id),
    itemStatus:
      readString(firstItem?.transaction_status) ||
      readString(asRecord(firstItem?.payout_item)?.transaction_status),
    debugId,
    raw: data,
  } satisfies PayPalPayoutCreateResult;
}

export async function verifyPayPalWebhookSignature(params: PayPalWebhookVerificationParams) {
  const { data } = await paypalRequest<{ verification_status?: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: {
        auth_algo: params.authAlgo,
        cert_url: params.certUrl,
        transmission_id: params.transmissionId,
        transmission_sig: params.transmissionSig,
        transmission_time: params.transmissionTime,
        webhook_id: params.webhookId,
        webhook_event: params.webhookEvent,
      },
    }
  );

  return data.verification_status === "SUCCESS";
}

export async function getPayPalPayoutItem(payoutItemId: string) {
  const { data } = await paypalRequest<Record<string, unknown>>(`/v1/payments/payouts-item/${payoutItemId}`);
  return data;
}

export function extractPayPalBatchId(payload: unknown) {
  const record = asRecord(payload);
  const resource = asRecord(record?.resource);
  return (
    readString(resource?.payout_batch_id) ||
    readString(asRecord(resource?.batch_header)?.payout_batch_id) ||
    readString(asRecord(resource?.payout_batch)?.payout_batch_id)
  );
}

export function extractPayPalItemId(payload: unknown) {
  const record = asRecord(payload);
  const resource = asRecord(record?.resource);
  return (
    readString(resource?.payout_item_id) ||
    readString(asRecord(resource?.payout_item)?.payout_item_id)
  );
}

export function extractPayPalItemStatus(payload: unknown) {
  const record = asRecord(payload);
  const resource = asRecord(record?.resource);
  return (
    readString(resource?.transaction_status) ||
    readString(asRecord(resource?.payout_item)?.transaction_status) ||
    readString(asRecord(resource?.batch_header)?.batch_status)
  );
}

export function extractPayPalErrorDetails(payload: unknown) {
  const record = asRecord(payload);
  const resource = asRecord(record?.resource);
  const errorRecord =
    asRecord(resource?.errors) ||
    asRecord(asArray(resource?.errors)?.[0]) ||
    asRecord(resource?.error);

  return {
    name: readString(errorRecord?.name),
    message: readString(errorRecord?.message) || readString(resource?.transaction_status),
  };
}

export function classifyPayPalPayoutError(error: unknown, fallbackMessage: string) {
  const typedError = error as PayPalErrorExtra & { message?: string };
  const message = typedError.message || fallbackMessage;
  const details = typedError.details ?? null;
  const code = typedError.code ?? null;
  const debugId = typedError.debugId ?? null;
  const normalized = `${message} ${details ?? ""}`.toLowerCase();

  let userMessage = fallbackMessage;

  if (normalized.includes("permission") || normalized.includes("not authorized")) {
    userMessage = "PayPal payouts are not enabled for this account yet.";
  } else if (normalized.includes("receiver") || normalized.includes("email")) {
    userMessage = "The saved PayPal email cannot receive this payout. Update it and try again.";
  } else if (normalized.includes("insufficient") || normalized.includes("balance")) {
    userMessage = "The payout account does not have enough PayPal balance to complete this withdrawal.";
  } else if (normalized.includes("authentication") || normalized.includes("oauth")) {
    userMessage = "PayPal configuration is invalid. Contact support.";
  }

  return {
    error: userMessage,
    details: details || message,
    code: code || "PAYPAL_PAYOUT_FAILED",
    paypalDebugId: debugId,
  };
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}
