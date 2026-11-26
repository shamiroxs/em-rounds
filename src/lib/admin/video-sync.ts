import type { SupabaseClient } from "@supabase/supabase-js";
import { UUID_RE } from "@/lib/learning";
import { writeAuditLog } from "@/lib/admin/audit";
import type { MuxAsset } from "@/lib/mux-admin";

// Applies Mux state to our media_assets rows. Used by the webhook and by the
// "Check status" button, always with the server-only service-role client.

export type MediaRow = {
  id: string;
  provider_asset_id: string | null;
  metadata: Record<string, unknown> | null;
};

const COLUMNS = "id, provider_asset_id, metadata";

function short(message: string) {
  return message.replace(/\s+/g, " ").trim().slice(0, 300);
}

async function save(admin: SupabaseClient, id: string, patch: Record<string, unknown>) {
  const { error } = await admin.from("media_assets").update(patch).eq("id", id);
  if (error) throw new Error(`media_assets update failed: ${error.code ?? ""} ${error.message}`);
}

export async function findMediaForEvent(
  admin: SupabaseClient,
  ids: { passthrough?: string | null; uploadId?: string | null },
): Promise<MediaRow | null> {
  if (ids.passthrough && UUID_RE.test(ids.passthrough)) {
    const { data, error } = await admin
      .from("media_assets")
      .select(COLUMNS)
      .eq("id", ids.passthrough)
      .eq("provider", "mux")
      .maybeSingle();
    if (error) throw new Error("media lookup failed");
    if (data) return data as unknown as MediaRow;
  }
  if (ids.uploadId) {
    const { data, error } = await admin
      .from("media_assets")
      .select(COLUMNS)
      .eq("provider", "mux")
      .eq("metadata->>upload_id", ids.uploadId)
      .maybeSingle();
    if (error) throw new Error("media lookup failed");
    if (data) return data as unknown as MediaRow;
  }
  return null;
}

export async function markUploadAssetCreated(
  admin: SupabaseClient,
  media: MediaRow,
  assetId: string,
) {
  const meta = media.metadata ?? {};
  if (meta.status === "ready") return;
  await save(admin, media.id, {
    provider_asset_id: assetId,
    metadata: { ...meta, status: "processing" },
  });
}

export async function markMediaFailed(admin: SupabaseClient, media: MediaRow, message: string) {
  const meta = media.metadata ?? {};
  if (meta.status === "ready") return; // never overwrite a working video
  await save(admin, media.id, {
    metadata: { ...meta, status: "error", error_message: short(message) },
  });
}

async function attachToLecture(admin: SupabaseClient, mediaId: string, lectureId: unknown) {
  if (typeof lectureId !== "string" || !UUID_RE.test(lectureId)) return null;
  // Only the NEWEST upload for a lecture may become its video.
  const { data: latest, error } = await admin
    .from("media_assets")
    .select("id")
    .eq("provider", "mux")
    .eq("metadata->>lecture_id", lectureId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("latest upload lookup failed");
  if (!latest || (latest as { id: string }).id !== mediaId) return null;

  const { error: updateError } = await admin
    .from("lectures")
    .update({ media_asset_id: mediaId })
    .eq("id", lectureId);
  if (updateError) throw new Error("lecture video attach failed");
  return lectureId;
}

export async function applyAssetSnapshot(
  admin: SupabaseClient,
  media: MediaRow,
  asset: MuxAsset,
): Promise<"ready" | "processing" | "error"> {
  const meta = media.metadata ?? {};

  if (asset.status === "errored") {
    await markMediaFailed(
      admin,
      media,
      asset.errors?.messages?.join(" ") || "Mux could not process this video.",
    );
    return meta.status === "ready" ? "ready" : "error";
  }

  if (asset.status !== "ready") {
    if (meta.status !== "ready") {
      await save(admin, media.id, {
        provider_asset_id: asset.id,
        metadata: { ...meta, status: "processing" },
      });
      return "processing";
    }
    return "ready";
  }

  // The asset is ready. Only SIGNED playback IDs are accepted.
  const signed = asset.playback_ids?.find((p) => p.policy === "signed");
  if (!signed) {
    await markMediaFailed(
      admin,
      media,
      "This video has no signed playback ID, so it was not attached. Upload it again from this page.",
    );
    return "error";
  }
  if (meta.status === "ready" && meta.playback_id === signed.id) return "ready"; // duplicate event

  const duration = typeof asset.duration === "number" ? Math.round(asset.duration) : null;
  await save(admin, media.id, {
    provider_asset_id: asset.id,
    duration_seconds: duration,
    metadata: {
      ...meta,
      status: "ready",
      playback_id: signed.id,
      playback_policy: "signed",
      error_message: null,
    },
  });

  const lectureId = await attachToLecture(admin, media.id, meta.lecture_id);
  if (lectureId) {
    await writeAuditLog({
      actorUserId: null,
      action: "lecture.video_ready",
      entityType: "lecture",
      entityId: lectureId,
      details: { media_asset_id: media.id, duration_seconds: duration },
    });
  }
  return "ready";
}