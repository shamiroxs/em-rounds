import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRazorpayPayment, type RazorpayPayment } from "./razorpay";

export const PRODUCT_CODE = "lifetime_platform";

export class PaymentMismatchError extends Error {}

type Order = {
  id: string;
  user_id: string;
  amount_minor: number | string;
  currency: string;
  status: string;
};

export async function findOrderByProviderId(
  admin: SupabaseClient,
  providerOrderId: string,
) {
  const { data } = await admin
    .from("orders")
    .select("id, user_id, amount_minor, currency, status")
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  return (data as Order | null) ?? null;
}

// Records a payment attempt. A captured payment must match our order exactly.
export async function recordPayment(
  admin: SupabaseClient,
  order: Order,
  payment: RazorpayPayment,
  status: "captured" | "failed",
) {
  if (status === "captured") {
    if (
      payment.amount !== Number(order.amount_minor) ||
      payment.currency !== order.currency.trim()
    ) {
      throw new PaymentMismatchError("Amount or currency does not match order.");
    }
  }

  // A payment ID can never move to a different order.
  const { data: existing } = await admin
    .from("payment_transactions")
    .select("order_id")
    .eq("provider_payment_id", payment.id)
    .maybeSingle();
  if (existing && existing.order_id !== order.id) {
    throw new PaymentMismatchError("Payment belongs to a different order.");
  }

  const row = {
    order_id: order.id,
    provider: "razorpay",
    provider_payment_id: payment.id,
    amount_minor: payment.amount,
    currency: payment.currency,
    status,
    // Minimal data only: no email, phone or card details.
    provider_payload: { method: payment.method ?? null, razorpay_status: payment.status },
  };

  const { error } =
    status === "captured"
      ? await admin
          .from("payment_transactions")
          .upsert(row, { onConflict: "provider_payment_id" })
      : // A failure must never overwrite a captured payment.
        await admin
          .from("payment_transactions")
          .upsert(row, { onConflict: "provider_payment_id", ignoreDuplicates: true });
  if (error) throw new Error("Could not record payment.");
}

export type OrderState = "none" | "paid" | "partially_refunded" | "refunded";

// Brings an order to the correct state from what is recorded in the database.
// Safe to call repeatedly and in any order of events.
export async function reconcileOrder(
  admin: SupabaseClient,
  orderId: string,
): Promise<OrderState> {
  const { data: order } = await admin
    .from("orders")
    .select("id, amount_minor, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return "none";

  const { data: captured } = await admin
    .from("payment_transactions")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "captured")
    .limit(1);
  if (!captured || captured.length === 0) return "none";

  const amount = Number(order.amount_minor);
  const { data: refunds } = await admin
    .from("refunds")
    .select("id, amount_minor")
    .eq("order_id", orderId)
    .eq("status", "processed");
  const refunded = (refunds ?? []).reduce((s, r) => s + Number(r.amount_minor), 0);

  // Full refund: revoke lifetime access.
  if (refunded >= amount) {
    const single = (refunds ?? []).find((r) => Number(r.amount_minor) === amount);
    if (single) {
      const { error } = await admin.rpc("process_full_refund_and_revoke", {
        target_refund_id: single.id,
        reason_text: "Full refund",
      });
      if (error) throw new Error("Could not revoke access after refund.");
    } else {
      // Full refund made in several parts.
      const { error: e1 } = await admin
        .from("entitlements")
        .update({
          status: "revoked",
          revoked_at: new Date().toISOString(),
          revoke_reason: "Full refund (cumulative)",
        })
        .eq("source_order_id", orderId)
        .eq("status", "active");
      const { error: e2 } = await admin
        .from("orders")
        .update({ status: "refunded" })
        .eq("id", orderId);
      if (e1 || e2) throw new Error("Could not revoke access after refund.");
    }
    return "refunded";
  }

  let status = order.status as string;
  if (["created", "pending", "failed"].includes(status)) {
    const { error } = await admin
      .from("orders")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", orderId)
      .in("status", ["created", "pending", "failed"]);
    if (error) throw new Error("Could not mark order paid.");
    status = "paid";
  }

  if (status === "paid") {
    // Idempotent: one entitlement per order and scope (unique index).
    const { error } = await admin.rpc("grant_entitlements_for_paid_order", {
      target_order_id: orderId,
    });
    if (error) throw new Error("Could not activate access.");

    // Partial refund: keep lifetime access, record the status.
    if (refunded > 0) {
      await admin
        .from("orders")
        .update({ status: "partially_refunded" })
        .eq("id", orderId)
        .eq("status", "paid");
      return "partially_refunded";
    }
  }
  return status === "partially_refunded" ? "partially_refunded" : "paid";
}

// ---------- Webhook event handling ----------

type Json = Record<string, unknown>;

function isPayment(v: unknown): v is RazorpayPayment {
  const p = v as Json | null;
  return (
    !!p &&
    typeof p.id === "string" &&
    typeof p.amount === "number" &&
    typeof p.currency === "string" &&
    typeof p.status === "string"
  );
}

type RefundEntity = {
  id: string;
  payment_id: string;
  amount: number;
  status: string;
};

function isRefund(v: unknown): v is RefundEntity {
  const r = v as Json | null;
  return (
    !!r &&
    typeof r.id === "string" &&
    typeof r.payment_id === "string" &&
    typeof r.amount === "number" &&
    typeof r.status === "string"
  );
}

function entity(event: Json, key: "payment" | "refund") {
  const payload = event.payload as Json | undefined;
  const wrapper = payload?.[key] as Json | undefined;
  return wrapper?.entity;
}

// Minimal, non-sensitive summary stored for audit/debugging.
export function sanitizeEvent(event: Json) {
  const payment = entity(event, "payment") as Json | undefined;
  const refund = entity(event, "refund") as Json | undefined;
  return {
    event: event.event,
    payment_id: payment?.id ?? null,
    order_id: payment?.order_id ?? null,
    refund_id: refund?.id ?? null,
    amount: payment?.amount ?? refund?.amount ?? null,
    currency: payment?.currency ?? refund?.currency ?? null,
    status: payment?.status ?? refund?.status ?? null,
  };
}

async function orderIdForPayment(admin: SupabaseClient, paymentId: string) {
  const { data } = await admin
    .from("payment_transactions")
    .select("order_id")
    .eq("provider_payment_id", paymentId)
    .maybeSingle();
  if (data) return data.order_id as string;

  // Refund arrived before the payment event: ask Razorpay directly.
  const payment = await fetchRazorpayPayment(paymentId);
  if (!payment.order_id) return null;
  const order = await findOrderByProviderId(admin, payment.order_id);
  return order?.id ?? null;
}

export async function processWebhookEvent(
  admin: SupabaseClient,
  event: Json,
): Promise<"processed" | "ignored"> {
  switch (event.event) {
    case "payment.captured":
    case "order.paid": {
      const payment = entity(event, "payment");
      if (!isPayment(payment) || !payment.order_id) return "ignored";
      if (payment.status !== "captured") return "ignored";
      const order = await findOrderByProviderId(admin, payment.order_id);
      if (!order) return "ignored"; // not an order created by this platform
      await recordPayment(admin, order, payment, "captured");
      await reconcileOrder(admin, order.id);
      return "processed";
    }

    case "payment.failed": {
      const payment = entity(event, "payment");
      if (!isPayment(payment) || !payment.order_id) return "ignored";
      const order = await findOrderByProviderId(admin, payment.order_id);
      if (!order) return "ignored";
      // The order stays open so the student can retry.
      await recordPayment(admin, order, payment, "failed");
      return "processed";
    }

    case "refund.created":
    case "refund.processed":
    case "refund.failed": {
      const refund = entity(event, "refund");
      if (!isRefund(refund)) return "ignored";
      if (!["pending", "processed", "failed"].includes(refund.status)) return "ignored";
      const orderId = await orderIdForPayment(admin, refund.payment_id);
      if (!orderId) return "ignored";

      // A late "pending" event must not undo a "processed" refund.
      const { data: existing } = await admin
        .from("refunds")
        .select("status")
        .eq("provider_refund_id", refund.id)
        .maybeSingle();
      if (!(existing?.status === "processed" && refund.status !== "processed")) {
        const { error } = await admin.from("refunds").upsert(
          {
            order_id: orderId,
            provider_refund_id: refund.id,
            amount_minor: refund.amount,
            status: refund.status,
            processed_at: refund.status === "processed" ? new Date().toISOString() : null,
          },
          { onConflict: "provider_refund_id" },
        );
        if (error) throw new Error("Could not record refund.");
      }
      await reconcileOrder(admin, orderId);
      return "processed";
    }

    // Disputes/chargebacks are not handled in this phase.
    default:
      return "ignored";
  }
}