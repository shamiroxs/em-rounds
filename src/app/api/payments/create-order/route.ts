import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser } from "@/lib/payments/server";
import { PRODUCT_CODE } from "@/lib/payments/process";
import { createRazorpayOrder, getRazorpayKeyId } from "@/lib/payments/razorpay";

export async function POST() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const admin = createAdminClient();
  const keyId = getRazorpayKeyId();
  if (!admin || !keyId) {
    return NextResponse.json({ error: "Payments are not available right now." }, { status: 503 });
  }

  // Already has lifetime access? Do not sell it twice.
  const { data: existing } = await admin
    .from("entitlements")
    .select("id")
    .eq("user_id", user.userId)
    .eq("scope_type", "platform")
    .eq("status", "active")
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "You already have lifetime access." }, { status: 409 });
  }

  // Price comes only from the database.
  const { data: product } = await admin
    .from("access_products")
    .select("id, amount_minor, currency, name")
    .eq("code", PRODUCT_CODE)
    .eq("is_active", true)
    .maybeSingle();
  if (!product || !product.amount_minor) {
    return NextResponse.json({ error: "This product is not available." }, { status: 503 });
  }

  // The product must really grant platform access.
  const { data: rule } = await admin
    .from("product_access_rules")
    .select("id")
    .eq("product_id", product.id)
    .eq("scope_type", "platform")
    .limit(1);
  if (!rule || rule.length === 0) {
    return NextResponse.json({ error: "This product is not configured." }, { status: 503 });
  }

  // Simple abuse limit.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.userId)
    .gte("created_at", since);
  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const amountMinor = Number(product.amount_minor);
  const currency = String(product.currency).trim();

  const { data: order, error: insertError } = await admin
    .from("orders")
    .insert({
      user_id: user.userId,
      product_id: product.id,
      amount_minor: amountMinor,
      currency,
    })
    .select("id")
    .single();
  if (insertError || !order) {
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }

  try {
    const rzpOrder = await createRazorpayOrder({
      amountMinor,
      currency,
      receipt: order.id,
      notes: { internal_order_id: order.id },
    });
    const { error } = await admin
      .from("orders")
      .update({ provider_order_id: rzpOrder.id, status: "pending" })
      .eq("id", order.id);
    if (error) throw new Error("link failed");

    return NextResponse.json({
      keyId,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      name: product.name,
      email: user.email ?? null,
    });
  } catch {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  }
}