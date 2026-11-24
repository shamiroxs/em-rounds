import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ExternalLink, FileText, VideoOff } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { signPlaybackToken } from "@/lib/mux";
import { UUID_RE, formatDuration } from "@/lib/learning";
import { VideoPlayer } from "@/components/learning/video-player";
import { LectureActions } from "@/components/learning/lecture-actions";

type LectureRow = {
  id: string;
  title: string;
  description: string | null;
  media_asset_id: string | null;
  topics: {
    title: string;
    subjects: { title: string; courses: { slug: string; title: string } };
  };
};

export default async function LecturePage({
  params,
}: {
  params: Promise<{ lectureId: string }>;
}) {
  const { lectureId } = await params;
  if (!UUID_RE.test(lectureId)) notFound();

  const { supabase } = await requireUser();

  // Step 1: the student's own session. RLS returns nothing if the lecture is
  // unpublished or the student has no access.
  const { data } = await supabase
    .from("lectures")
    .select(
      `id, title, description, media_asset_id,
       topics ( title, subjects ( title, courses ( slug, title ) ) )`,
    )
    .eq("id", lectureId)
    .maybeSingle();

    if (!data) {
    // RLS hid it. Published but locked → checkout. Anything else → 404.
    const admin = createAdminClient();
    if (admin) {
      const { data: row } = await admin
        .from("lectures")
        .select("status, topics ( status, subjects ( status, courses ( slug, status ) ) )")
        .eq("id", lectureId)
        .maybeSingle();
      const topic = row?.topics as unknown as {
        status: string;
        subjects: { status: string; courses: { slug: string; status: string } };
      } | null;
      if (
        row?.status === "published" &&
        topic?.status === "published" &&
        topic.subjects.status === "published" &&
        topic.subjects.courses.status === "published"
      ) {
        redirect(`/checkout?next=${encodeURIComponent(`/learn/${topic.subjects.courses.slug}`)}`);
      }
    }
    notFound();
  }

  const lecture = data as unknown as LectureRow;

  const [objectivesRes, resourcesRes, progressRes, bookmarkRes] = await Promise.all([
    supabase.from("lecture_objectives").select("id, objective, sort_order")
      .eq("lecture_id", lectureId).order("sort_order"),
    supabase.from("lecture_resources").select("id, title, description, external_url, sort_order")
      .eq("lecture_id", lectureId).order("sort_order"),
    supabase.from("lecture_progress").select("progress_seconds, completed_at")
      .eq("lecture_id", lectureId).maybeSingle(),
    supabase.from("lecture_bookmarks").select("lecture_id")
      .eq("lecture_id", lectureId).maybeSingle(),
  ]);

  // Step 2: only now read the protected media record, on the server.
  let playbackId: string | null = null;
  let duration: number | null = null;
  let token: string | null = null;
  let videoStatus: "ok" | "none" | "unavailable" = "none";

  if (lecture.media_asset_id) {
    const admin = createAdminClient();
    if (!admin) {
      videoStatus = "unavailable";
    } else {
      const { data: media } = await admin
        .from("media_assets")
        .select("provider, duration_seconds, metadata")
        .eq("id", lecture.media_asset_id)
        .maybeSingle();

      duration = media?.duration_seconds ?? null;
      const pid = (media?.metadata as { playback_id?: unknown } | null)?.playback_id;
      if (media?.provider === "mux" && typeof pid === "string" && pid) {
        playbackId = pid;
        token = await signPlaybackToken(pid);
        videoStatus = token ? "ok" : "unavailable";
      } else {
        videoStatus = "unavailable";
      }
    }
  }

  const course = lecture.topics.subjects.courses;
  const objectives = objectivesRes.data ?? [];
  const resources = resourcesRes.data ?? [];
  const startTime = progressRes.data?.completed_at
    ? 0
    : (progressRes.data?.progress_seconds ?? 0);

  return (
    <>
      <Link href={`/learn/${course.slug}`} className="text-link breadcrumb">
        <ChevronLeft size={16} aria-hidden /> {course.title}
      </Link>
      <p className="breadcrumb" style={{ marginTop: "0.5rem" }}>
        {lecture.topics.subjects.title} · {lecture.topics.title}
      </p>
      <h1 className="page-title" style={{ marginTop: "0.35rem" }}>
        {lecture.title}
      </h1>

      <div className="lecture-layout">
        <div>
          {videoStatus === "ok" && playbackId && token ? (
            <VideoPlayer lectureId={lecture.id} playbackId={playbackId}
              token={token} title={lecture.title} startTime={startTime} />
          ) : (
            <div className="video-message" role="status">
              <VideoOff size={28} aria-hidden />
              <p>
                {videoStatus === "none"
                  ? "No video has been added to this lecture yet."
                  : "The video is temporarily unavailable. Please try again later."}
              </p>
            </div>
          )}

          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem",
            flexWrap: "wrap", alignItems: "center" }}>
            <LectureActions lectureId={lecture.id}
              initialBookmarked={!!bookmarkRes.data}
              initialCompleted={!!progressRes.data?.completed_at} />
            {formatDuration(duration) && (
              <span className="badge">{formatDuration(duration)}</span>
            )}
          </div>

          {lecture.description && (
            <section style={{ marginTop: "1.5rem" }}>
              <h2 className="section-title" style={{ fontSize: "1.15rem" }}>About this lecture</h2>
              <p className="prose-text" style={{ marginTop: "0.5rem" }}>{lecture.description}</p>
            </section>
          )}
        </div>

        <aside>
          {objectives.length > 0 && (
            <section className="surface-card">
              <h2 className="section-title" style={{ fontSize: "1.05rem" }}>Learning objectives</h2>
              <ul style={{ marginTop: "0.6rem", paddingLeft: "1.1rem", lineHeight: 1.6 }}>
                {objectives.map((o) => <li key={o.id}>{o.objective}</li>)}
              </ul>
            </section>
          )}

          {resources.length > 0 && (
            <section className="surface-card" style={{ marginTop: "1rem" }}>
              <h2 className="section-title" style={{ fontSize: "1.05rem" }}>Resources</h2>
              <div style={{ marginTop: "0.5rem" }}>
                {resources.map((r) =>
                  r.external_url ? (
                    <a key={r.id} href={r.external_url} target="_blank"
                      rel="noopener noreferrer" className="lecture-row">
                      <ExternalLink size={18} aria-hidden />
                      <span className="lecture-title">{r.title}</span>
                    </a>
                  ) : (
                    <div key={r.id} className="lecture-row">
                      <FileText size={18} aria-hidden />
                      <span>
                        <span className="lecture-title">{r.title}</span>
                        <span className="muted-copy" style={{ display: "block", fontSize: "0.8rem" }}>
                          File downloads are not enabled yet.
                        </span>
                      </span>
                    </div>
                  ),
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}