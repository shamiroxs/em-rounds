import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, VideoOff } from "lucide-react";
import { requireCapability } from "@/lib/admin/access";
import { UUID_RE, formatDuration } from "@/lib/learning";
import { signPlaybackToken } from "@/lib/mux";
import { loadVideoState, hasPlayableVideo } from "@/lib/admin/lecture-data";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { PreviewPlayer } from "@/components/admin/lectures/preview-player";

export const instant = false;

export default async function LecturePreviewPage({
  params,
}: {
  params: Promise<{ lectureId: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { lectureId } = await params;
  if (!UUID_RE.test(lectureId)) notFound();

  const { data, error } = await staff.supabase
    .from("lectures")
    .select("id, title, description, status, media_asset_id")
    .eq("id", lectureId)
    .maybeSingle();
  if (error) {
    return <div className="error-box" role="alert">This lecture could not be loaded. Refresh the page to try again.</div>;
  }
  if (!data) notFound();
  const lecture = data as unknown as {
    id: string;
    title: string;
    description: string | null;
    status: string;
    media_asset_id: string | null;
  };

  const [video, objectivesRes, resourcesRes] = await Promise.all([
    loadVideoState(staff.supabase, lecture),
    staff.supabase.from("lecture_objectives").select("id, objective").eq("lecture_id", lectureId).order("sort_order").order("id"),
    staff.supabase.from("lecture_resources").select("id, title, description, external_url").eq("lecture_id", lectureId).order("sort_order").order("id"),
  ]);
  const objectives = (objectivesRes.data ?? []) as unknown as { id: string; objective: string }[];
  const resources = (resourcesRes.data ?? []) as unknown as {
    id: string;
    title: string;
    description: string | null;
    external_url: string | null;
  }[];

  // A short-lived signed token, created on the server. The signing secret never reaches the browser.
  const playbackId = hasPlayableVideo(video.attached) ? video.attached?.playbackId ?? null : null;
  const token = playbackId ? await signPlaybackToken(playbackId) : null;
  const duration = formatDuration(video.attached?.durationSeconds);

  return (
    <>
      <div className="error-box" role="note" style={{ marginBottom: "1rem" }}>
        <strong>Preview.</strong> This is how the lecture will look. Students only see it once it is
        published and they have access. Watching here does not save progress.
      </div>
      <PageHeader
        title={lecture.title}
        description={lecture.description ?? "No description yet."}
        actions={
          <>
            <StatusBadge status={lecture.status} />
            {duration && <span className="admin-badge">{duration}</span>}
          </>
        }
      />

      <div className="admin-form-grid" style={{ maxWidth: "54rem" }}>
        {playbackId && token ? (
          <PreviewPlayer playbackId={playbackId} token={token} title={lecture.title} />
        ) : (
          <div className="admin-empty" role="status">
            <VideoOff size={28} aria-hidden />
            <p className="admin-empty-title">
              {playbackId ? "Playback is not configured on the server." : "No playable video yet."}
            </p>
            <p className="muted-copy">
              {playbackId
                ? "Check MUX_SIGNING_KEY_ID and MUX_SIGNING_PRIVATE_KEY."
                : "Upload a video on the lecture page and wait until it is ready."}
            </p>
          </div>
        )}

        {objectives.length > 0 && (
          <section className="surface-card">
            <h2 className="section-title admin-section-title">Learning objectives</h2>
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {objectives.map((o) => (<li key={o.id}>{o.objective}</li>))}
            </ul>
          </section>
        )}

        {resources.length > 0 && (
          <section className="surface-card">
            <h2 className="section-title admin-section-title">Resources</h2>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.6rem" }}>
              {resources.map((r) => (
                <li key={r.id}>
                  {r.external_url ? (
                    <a href={r.external_url} target="_blank" rel="noopener noreferrer" className="text-link">
                      {r.title} <ExternalLink size={14} aria-hidden style={{ display: "inline" }} />
                    </a>
                  ) : (
                    <span>{r.title} (no link)</span>
                  )}
                  {r.description && <div className="muted-copy" style={{ fontSize: "0.9rem" }}>{r.description}</div>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link href={`/admin/lectures/${lecture.id}`} className="text-link">← Back to editing</Link>
      </div>
    </>
  );
}