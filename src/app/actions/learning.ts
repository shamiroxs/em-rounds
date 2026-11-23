"use server";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_RE } from "@/lib/learning";

type Result = { ok: true; completed?: boolean } | { ok: false; error: string };

const MIN_SECONDS_TO_RECORD = 10;
const COMPLETION_RATIO = 0.9;

async function getVisibleLecture(lectureId: string) {
  const { supabase, userId } = await requireUser();
  if (!UUID_RE.test(lectureId)) return null;
  // RLS decides: unpublished or unentitled lectures return no row.
  const { data } = await supabase
    .from("lectures")
    .select("id, media_asset_id")
    .eq("id", lectureId)
    .maybeSingle();
  if (!data) return null;
  return { supabase, userId, lecture: data };
}

async function getDuration(mediaAssetId: string | null) {
  if (!mediaAssetId) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("media_assets")
    .select("duration_seconds")
    .eq("id", mediaAssetId)
    .maybeSingle();
  return data?.duration_seconds ?? null;
}

export async function saveProgress(
  lectureId: string,
  positionSeconds: number,
): Promise<Result> {
  const ctx = await getVisibleLecture(lectureId);
  if (!ctx) return { ok: false, error: "Lecture not available." };
  if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
    return { ok: false, error: "Invalid position." };
  }
  const seconds = Math.floor(positionSeconds);
  // Opening a page alone must not create a history record.
  if (seconds < MIN_SECONDS_TO_RECORD) return { ok: true };

  const duration = await getDuration(ctx.lecture.media_asset_id);
  const reachedEnd = duration !== null && seconds >= duration * COMPLETION_RATIO;

  const row: Record<string, unknown> = {
    user_id: ctx.userId,
    lecture_id: lectureId,
    progress_seconds: seconds,
  };
  if (reachedEnd) {
    const { data: existing } = await ctx.supabase
      .from("lecture_progress")
      .select("completed_at")
      .eq("lecture_id", lectureId)
      .maybeSingle();
    if (!existing?.completed_at) row.completed_at = new Date().toISOString();
  }

  const { error } = await ctx.supabase
    .from("lecture_progress")
    .upsert(row, { onConflict: "user_id,lecture_id" });
  if (error) return { ok: false, error: "Could not save progress." };
  return { ok: true, completed: reachedEnd };
}

export async function setCompletion(
  lectureId: string,
  completed: boolean,
): Promise<Result> {
  const ctx = await getVisibleLecture(lectureId);
  if (!ctx) return { ok: false, error: "Lecture not available." };

  const { error } = await ctx.supabase.from("lecture_progress").upsert(
    {
      user_id: ctx.userId,
      lecture_id: lectureId,
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,lecture_id" },
  );
  if (error) return { ok: false, error: "Could not update completion." };
  return { ok: true, completed };
}

export async function setBookmark(
  lectureId: string,
  bookmarked: boolean,
): Promise<Result> {
  const ctx = await getVisibleLecture(lectureId);
  if (!ctx) return { ok: false, error: "Lecture not available." };

  if (bookmarked) {
    const { error } = await ctx.supabase
      .from("lecture_bookmarks")
      .upsert(
        { user_id: ctx.userId, lecture_id: lectureId },
        { onConflict: "user_id,lecture_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false, error: "Could not save bookmark." };
  } else {
    const { error } = await ctx.supabase
      .from("lecture_bookmarks")
      .delete()
      .eq("user_id", ctx.userId)
      .eq("lecture_id", lectureId);
    if (error) return { ok: false, error: "Could not remove bookmark." };
  }
  return { ok: true };
}