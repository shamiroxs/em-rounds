import type { SupabaseClient } from "@supabase/supabase-js";
import { lectureMissingForPublish } from "@/lib/admin/lecture-validation";
import type { ContentStatus } from "@/lib/admin/validation";

export type LectureRow = {
  id: string;
  topic_id: string;
  media_asset_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  transcript: string | null;
  status: ContentStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type TopicOption = { id: string; label: string; disabled: boolean };

export async function loadTopicOptions(supabase: SupabaseClient): Promise<TopicOption[]> {
  const { data, error } = await supabase
    .from("topics")
    .select("id, title, status, subjects(title, courses(title))")
    .limit(2000);
  if (error) throw new Error("Could not load topics");
  type Raw = {
    id: string;
    title: string;
    status: string;
    subjects: { title: string; courses: { title: string } | null } | null;
  };
  return ((data ?? []) as unknown as Raw[])
    .map((t) => ({
      id: t.id,
      label: `${t.subjects?.courses?.title ?? "Course"} › ${t.subjects?.title ?? "Subject"} › ${t.title}`,
      disabled: t.status === "archived",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

type MediaRaw = {
  id: string;
  provider: string;
  provider_asset_id: string | null;
  duration_seconds: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const MEDIA_COLUMNS = "id, provider, provider_asset_id, duration_seconds, metadata, created_at";

function describeMedia(m: MediaRaw) {
  const meta = m.metadata ?? {};
  const playbackId =
    typeof meta.playback_id === "string" && meta.playback_id ? meta.playback_id : null;
  const status =
    typeof meta.status === "string" ? meta.status : playbackId ? "ready" : "unknown";
  return {
    id: m.id,
    provider: m.provider,
    status,
    playbackId,
    durationSeconds: m.duration_seconds,
    providerAssetId: m.provider_asset_id,
    errorMessage: typeof meta.error_message === "string" ? meta.error_message : null,
    source: typeof meta.source === "string" ? meta.source : null,
  };
}

export type VideoInfo = ReturnType<typeof describeMedia>;

/** `attached` = what students would watch. `pending` = a newer upload still in progress or failed. */
export type VideoState = { attached: VideoInfo | null; pending: VideoInfo | null };

export async function loadVideoState(
  supabase: SupabaseClient,
  lecture: { id: string; media_asset_id: string | null },
): Promise<VideoState> {
  let attached: VideoInfo | null = null;
  if (lecture.media_asset_id) {
    const { data, error } = await supabase
      .from("media_assets")
      .select(MEDIA_COLUMNS)
      .eq("id", lecture.media_asset_id)
      .maybeSingle();
    if (error) throw new Error("Could not load the video record");
    if (data) attached = describeMedia(data as unknown as MediaRaw);
  }

  const { data: latest, error: latestError } = await supabase
    .from("media_assets")
    .select(MEDIA_COLUMNS)
    .eq("provider", "mux")
    .eq("metadata->>lecture_id", lecture.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw new Error("Could not load the upload status");

  let pending: VideoInfo | null = null;
  if (latest) {
    const info = describeMedia(latest as unknown as MediaRaw);
    if (info.id !== attached?.id && info.status !== "ready") pending = info;
  }
  return { attached, pending };
}

export function hasPlayableVideo(video: VideoInfo | null) {
  return !!video && video.provider === "mux" && !!video.playbackId;
}

/** Shared by the page and the publish action, so both always agree. */
export async function loadReadiness(
  supabase: SupabaseClient,
  lecture: {
    id: string;
    title: string;
    slug: string;
    description: string | null;
    media_asset_id: string | null;
  },
) {
  const [video, objectives] = await Promise.all([
    loadVideoState(supabase, lecture),
    supabase
      .from("lecture_objectives")
      .select("id", { count: "exact", head: true })
      .eq("lecture_id", lecture.id),
  ]);
  if (objectives.error) throw new Error("Could not count learning objectives");

  const objectiveCount = objectives.count ?? 0;
  const hasReadyVideo = hasPlayableVideo(video.attached);
  const missing = lectureMissingForPublish({
    title: lecture.title,
    slug: lecture.slug,
    description: lecture.description,
    hasReadyVideo,
    objectiveCount,
  });
  return { video, objectiveCount, hasReadyVideo, missing };
}