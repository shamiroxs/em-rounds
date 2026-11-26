import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MuxAsset, MuxUpload } from "@/lib/mux-admin";
import {
  applyAssetSnapshot,
  findMediaForEvent,
  markMediaFailed,
  markUploadAssetCreated,
} from "@/lib/admin/video-sync";

const TOLERANCE_SECONDS = 300;

// Mux sends:  Mux-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
function verifySignature(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const piece of header.split(",")) {
    const i = piece.indexOf("=");
    if (i <= 0) continue;
    const key = piece.slice(0, i).trim();
    const value = piece.slice(i + 1).trim();
    if (key === "t") timestamp = value;
    if (key === "v1") signatures.push(value.toLowerCase());
  }
  const t = Number(timestamp);
  if (!Number.isInteger(t) || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - t) > TOLERANCE_SECONDS) return false;

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex"),
    "utf8",
  );
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export async function POST(request: Request) {
  const secret = process.env.MUX_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  // The exact raw body is needed for verification. Do not parse it first.
  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("mux-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (typeof event.type !== "string" || !event.data || typeof event.data !== "object") {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Unavailable" }, { status: 503 });

  try {
    switch (event.type) {
      case "video.asset.created":
      case "video.asset.ready":
      case "video.asset.errored": {
        const asset = event.data as MuxAsset;
        const media = await findMediaForEvent(admin, {
          passthrough: asset.passthrough,
          uploadId: asset.upload_id,
        });
        if (!media) return NextResponse.json({ ok: true, ignored: true });
        await applyAssetSnapshot(admin, media, asset);
        break;
      }
      case "video.upload.asset_created": {
        const upload = event.data as MuxUpload;
        const media = await findMediaForEvent(admin, { uploadId: upload.id });
        if (!media || !upload.asset_id) return NextResponse.json({ ok: true, ignored: true });
        await markUploadAssetCreated(admin, media, upload.asset_id);
        break;
      }
      case "video.upload.errored":
      case "video.upload.cancelled": {
        const upload = event.data as MuxUpload;
        const media = await findMediaForEvent(admin, { uploadId: upload.id });
        if (!media) return NextResponse.json({ ok: true, ignored: true });
        await markMediaFailed(
          admin,
          media,
          event.type === "video.upload.cancelled"
            ? "The upload was cancelled."
            : upload.error?.message || "The upload failed.",
        );
        break;
      }
      default:
        return NextResponse.json({ ok: true, ignored: true });
    }
  } catch (error) {
    // 500 makes Mux retry later. Only the message is logged, never the payload.
    console.error("Mux webhook processing failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}