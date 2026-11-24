import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.razorpay.com/v1";

export type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method?: string;
};

export type RazorpayOrder = { id: string; amount: number; currency: string };

export function getRazorpayKeyId() {
  return process.env.RAZORPAY_KEY_ID ?? null;
}

async function razorpay<T>(
  path: string,
  init?: { method?: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured.");

  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Razorpay API error (${res.status}).`);
  return (await res.json()) as T;
}

export function createRazorpayOrder(input: {
  amountMinor: number;
  currency: string;
  receipt: string;
  notes: Record<string, string>;
}) {
  return razorpay<RazorpayOrder>("/orders", {
    method: "POST",
    body: {
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    },
  });
}

export function fetchRazorpayPayment(paymentId: string) {
  return razorpay<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

function hmacMatches(message: string, secret: string, signature: string) {
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Checkout signature: HMAC-SHA256 of "order_id|payment_id" with the Key Secret.
export function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  return hmacMatches(`${orderId}|${paymentId}`, secret, signature);
}

// Webhook signature: HMAC-SHA256 of the exact raw body with the webhook secret.
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  return hmacMatches(rawBody, secret, signature);
}