"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { authorizeAction, type StaffContext } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_RE } from "@/lib/learning";
import { isMuxPlaybackIdFormat } from "@/lib/admin/lecture-validation";
import { loadVideoState } from "@/lib/admin/lecture-data";
import {
  MuxApiError,
  createDirectUpload,
  getAsset,
  getPlaybackIdInfo,
  getUpload,
  muxConfigured,
} from "@/lib/mux-admin";
import { applyAssetSnapshot, markMediaFailed, type MediaRow } from "@/lib/admin/video-sync";

const NOT_CONFIGURED =
  "Video uploads are not configured on the server. Add MUX_TOKEN_ID and MUX_TOKEN_SECRET to the environment.";

type Lecture = { id: string; title: string; status: string; media_asset_id: string | null };

// Editors may change the video of a DRAFT lecture only. Administrators always.
async function loadLecture(
  staff: StaffContext,
  lectureId: string,
  requireChangeRight: boolean,
): Promise<{ ok: true; lecture: Lecture } | { ok: false; error: string }> {
  if (!UUID_RE.test(lectureId)) return { ok: false, error: "Invalid lecture." };
  const { data, error } = await staff.supabase
    .from("lectures")
    .select("id, title, status, media_asset_id")
    .eq("id", lectureId)
    .maybeSingle();
  if (error) return { ok: false, error: "Could not load the lecture. Please try again." };
  const lecture = data as Lecture | null;
  if (!lecture) return { ok: false, error: "Lecture not found." };
  if (requireChangeRight && lecture.status !== "draft" && !staff.can("content.publish")) {
    return { ok: false, error: "Only an administrator can change the video of a published or archived lecture." };
  }
  return { ok: true, lecture };
}

function done(lectureId: string) {
  revalidatePath(`/admin/lectures/${lectureId}`);
  revalidatePath("/learn");
}

export type UploadResult =
  | { ok: true; uploadUrl: string; mediaAssetId: string }
  | { ok: false; error: string };

/** Called by the uploader when a file is chosen. Creates the record and a one-time Mux upload link. */
export async function createVideoUpload(lectureId: string): Promise<UploadResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  if (!muxConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const loaded = await loadLecture(staff, lectureId, true);
  if (!loaded.ok) return loaded;
  const { lecture } = loaded;

  const baseMeta = { status: "waiting", lecture_id: lecture.id, playback_policy: "signed" };
  const { data: media, error: insertError } = await staff.supabase
    .from("media_assets")
    .insert({
      provider: "mux",
      media_type: "video",
      title: lecture.title,
      created_by: staff.userId,
      metadata: baseMeta,
    })
    .select("id")
    .single();
  if (insertError || !media) {
    console.error("media insert failed:", insertError?.code, insertError?.message);
    return { ok: false, error: "Could not start the upload. Please try again." };
  }
  const mediaId = (media as { id: string }).id;

  try {
    const h = await headers();
    const upload = await createDirectUpload({
      corsOrigin: h.get("origin") ?? "*",
      passthrough: mediaId,
    });
    if (!upload.url) throw new MuxApiError("Mux did not return an upload link.");

    const { error: updateError } = await staff.supabase
      .from("media_assets")
      .update({ metadata: { ...baseMeta, upload_id: upload.id } })
      .eq("id", mediaId);
    if (updateError) throw new MuxApiError("Could not record the upload. Please try again.");

    await writeAuditLog({
      actorUserId: staff.userId,
      action: "lecture.video_upload_started",
      entityType: "lecture",
      entityId: lecture.id,
      details: { media_asset_id: mediaId },
    });
    done(lecture.id);
    return { ok: true, uploadUrl: upload.url, mediaAssetId: mediaId };
  } catch (error) {
    await staff.supabase.from("media_assets").delete().eq("id", mediaId); // clean up the empty record
    return {
      ok: false,
      error: error instanceof MuxApiError ? error.message : "Could not start the upload. Please try again.",
    };
  }
}

export type RefreshResult = { ok: true; message: string } | { ok: false; error: string };

/** Fallback if a webhook was missed: asks Mux directly and updates our record. */
export async function refreshVideoStatus(lectureId: string): Promise<RefreshResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  if (!muxConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const loaded = await loadLecture(staff, lectureId, false);
  if (!loaded.ok) return loaded;

  let pendingId: string | null = null;
  try {
    pendingId = (await loadVideoState(staff.supabase, loaded.lecture)).pending?.id ?? null;
  } catch {
    return { ok: false, error: "Could not read the video status. Please try again." };
  }
  if (!pendingId) return { ok: true, message: "No upload is waiting or processing." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "The server is not configured to update video records." };

  const { data, error } = await admin
    .from("media_assets")
    .select("id, provider_asset_id, metadata")
    .eq("id", pendingId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not read the video record." };
  const row = data as unknown as MediaRow;

  try {
    let assetId = row.provider_asset_id;
    if (!assetId) {
      const uploadId = row.metadata?.upload_id;
      if (typeof uploadId !== "string") return { ok: false, error: "This upload has no Mux reference." };
      const upload = await getUpload(uploadId);
      if (["errored", "cancelled", "timed_out"].includes(upload.status)) {
        await markMediaFailed(admin, row, upload.error?.message || "The upload did not complete.");
        done(lectureId);
        return { ok: true, message: "The upload did not complete. Please upload the video again." };
      }
      if (!upload.asset_id) return { ok: true, message: "The file has not finished uploading yet." };
      assetId = upload.asset_id;
    }
    const asset = await getAsset(assetId);
    const result = await applyAssetSnapshot(admin, row, asset);
    done(lectureId);
    return {
      ok: true,
      message:
        result === "ready"
          ? "The video is ready."
          : result === "processing"
            ? "Mux is still processing the video."
            : "The video could not be processed. See the message on this page.",
    };
  } catch (e) {
    if (e instanceof MuxApiError) return { ok: false, error: e.message };
    console.error("refreshVideoStatus failed:", e instanceof Error ? e.message : "unknown");
    return { ok: false, error: "Could not check the video status. Please try again." };
  }
}

/** Attaches a video that already exists in your Mux account. Only SIGNED playback IDs are allowed. */
export async function attachPlaybackId(
  lectureId: string,
  playbackIdInput: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  if (!muxConfigured()) return { ok: false, error: NOT_CONFIGURED };

  const loaded = await loadLecture(staff, lectureId, true);
  if (!loaded.ok) return loaded;
  const { lecture } = loaded;

  const playbackId = playbackIdInput.trim();
  if (!isMuxPlaybackIdFormat(playbackId)) {
    return { ok: false, error: "That does not look like a Mux playback ID (letters and numbers only)." };
  }

  let assetId: string;
  let duration: number | null;
  try {
    const info = await getPlaybackIdInfo(playbackId);
    if (info.object.type !== "asset") return { ok: false, error: "That playback ID does not belong to a video asset." };
    if (info.policy !== "signed") {
      return {
        ok: false,
        error: "That playback ID is public. Only signed playback IDs can be used, so that student access control works.",
      };
    }
    const asset = await getAsset(info.object.id);
    if (asset.status !== "ready") return { ok: false, error: "That video is not ready in Mux yet." };
    assetId = asset.id;
    duration = typeof asset.duration === "number" ? Math.round(asset.duration) : null;
  } catch (e) {
    return { ok: false, error: e instanceof MuxApiError ? e.message : "Could not verify the playback ID." };
  }

  const { data: media, error } = await staff.supabase
    .from("media_assets")
    .insert({
      provider: "mux",
      provider_asset_id: assetId,
      media_type: "video",
      title: lecture.title,
      duration_seconds: duration,
      created_by: staff.userId,
      metadata: {
        status: "ready",
        playback_id: playbackId,
        playback_policy: "signed",
        lecture_id: lecture.id,
        source: "manual",
      },
    })
    .select("id")
    .single();
  if (error || !media) return { ok: false, error: "Could not save the video record. Please try again." };
  const mediaId = (media as { id: string }).id;

  const { data: updated, error: attachError } = await staff.supabase
    .from("lectures")
    .update({ media_asset_id: mediaId })
    .eq("id", lecture.id)
    .select("id")
    .maybeSingle();
  if (attachError || !updated) {
    await staff.supabase.from("media_assets").delete().eq("id", mediaId);
    return { ok: false, error: "You do not have permission to change this lecture's video." };
  }

  await writeAuditLog({
    actorUserId: staff.userId,
    action: "lecture.video_attach",
    entityType: "lecture",
    entityId: lecture.id,
    details: { media_asset_id: mediaId, source: "manual" },
  });
  done(lecture.id);
  return { ok: true };
}

/** Detaches the video from the lecture. (The file stays in Mux; delete it there if no longer needed.) */
export async function removeVideo(lectureId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;

  const loaded = await loadLecture(staff, lectureId, true);
  if (!loaded.ok) return loaded;
  const { lecture } = loaded;

  if (lecture.status === "published") {
    return { ok: false, error: "Unpublish the lecture before removing its video." };
  }
  if (!lecture.media_asset_id) return { ok: true };

  const { data, error } = await staff.supabase
    .from("lectures")
    .update({ media_asset_id: null })
    .eq("id", lecture.id)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not remove the video. Please try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: "lecture.video_remove",
    entityType: "lecture",
    entityId: lecture.id,
    details: { media_asset_id: lecture.media_asset_id },
  });
  done(lecture.id);
  return { ok: true };
}