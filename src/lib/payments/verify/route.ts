import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "@/lib/payments/server";
import {
  PaymentMismatchError,
  findOrderByProviderId,
  recordPayment,
  reconcileOrder,
} from "@/lib/payments/process";
import { fetchRazorpayPayment, verifyCheckoutSignature } from "@/lib/payments/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;

  if (
    typeof orderId !== "string" || !/^order_[A-Za-z0-9]{6,40}$/.test(orderId) ||
    typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]{6,40}$/.test(paymentId) ||
    typeof signature !== "string" || !/^[a-f0-9]{64}$/.test(signature)
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // The order must exist AND belong to the signed-in student.
  const order = await findOrderByProviderId(admin, orderId);
  if (!order || order.user_id !== user.userId) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
    return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
  }

  try {
    // Never trust the browser: ask Razorpay for the real payment status.
    const payment = await fetchRazorpayPayment(paymentId);
    if (payment.order_id !== orderId) {
      return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
    }
    if (payment.status === "failed") {
      return NextResponse.json({ status: "failed" });
    }
    if (payment.status !== "captured") {
      return NextResponse.json({ status: "pending" });
    }

    await recordPayment(admin, order, payment, "captured");
    const state = await reconcileOrder(admin, order.id);
    return NextResponse.json({
      status: state === "paid" || state === "partially_refunded" ? "paid" : state,
    });
  } catch (e) {
    if (e instanceof PaymentMismatchError) {
      console.error("Payment mismatch rejected for order", order.id);
      return NextResponse.json({ error: "Payment could not be verified." }, { status: 400 });
    }
    console.error("Payment verification failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 });
  }
}