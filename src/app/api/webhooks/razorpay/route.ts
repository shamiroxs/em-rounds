import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processWebhookEvent, sanitizeEvent } from "@/lib/payments/process";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";

export async function POST(request: Request) {
  // Read the exact raw body. It must not be parsed before verification.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");

  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventId = request.headers.get("x-razorpay-event-id");
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!eventId || typeof event.event !== "string") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  // Event-level deduplication through the unique (provider, event id) constraint.
  const { error: insertError } = await admin.from("payment_webhook_events").insert({
    provider: "razorpay",
    provider_event_id: eventId,
    event_type: event.event,
    processing_status: "processing",
    payload_sanitized: sanitizeEvent(event),
  });

  if (insertError) {
    if (insertError.code !== "23505") {
      return NextResponse.json({ error: "Could not store event" }, { status: 500 });
    }
    const { data: existing } = await admin
      .from("payment_webhook_events")
      .select("processing_status")
      .eq("provider", "razorpay")
      .eq("provider_event_id", eventId)
      .maybeSingle();
    if (existing && ["processed", "ignored"].includes(existing.processing_status)) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    // Earlier attempt failed or was interrupted: process again. This is safe
    // because every step is idempotent.
  }

  try {
    const outcome = await processWebhookEvent(admin, event);
    await admin
      .from("payment_webhook_events")
      .update({
        processing_status: outcome,
        processed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("provider", "razorpay")
      .eq("provider_event_id", eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message.slice(0, 200) : "Unknown error";
    console.error("Webhook processing failed:", eventId, message);
    await admin
      .from("payment_webhook_events")
      .update({ processing_status: "failed", error_message: message })
      .eq("provider", "razorpay")
      .eq("provider_event_id", eventId);
    // A non-200 response makes Razorpay retry later.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}