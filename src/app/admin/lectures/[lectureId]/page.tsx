import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { UUID_RE, formatDuration } from "@/lib/learning";
import type { ContentStatus } from "@/lib/admin/validation";
import { loadReadiness, loadTopicOptions, type LectureRow } from "@/lib/admin/lecture-data";
import { muxConfigured } from "@/lib/mux-admin";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { LectureForm } from "@/components/admin/lectures/lecture-form";
import { LectureStatusControls } from "@/components/admin/lectures/lecture-status-controls";
import { DeleteLectureButton } from "@/components/admin/lectures/delete-lecture-button";
import { VideoPanel, type VideoView } from "@/components/admin/lectures/video-panel";
import { ObjectivesEditor } from "@/components/admin/lectures/objectives-editor";
import { ResourcesEditor } from "@/components/admin/lectures/resources-editor";

export const instant = false;

type LectureWithTopic = LectureRow & { topics: { id: string; title: string } | null };

function toView(v: {
  id: string;
  status: string;
  playbackId: string | null;
  durationSeconds: number | null;
  providerAssetId: string | null;
  errorMessage: string | null;
  source: string | null;
} | null): VideoView | null {
  if (!v) return null;
  return {
    id: v.id,
    status: v.status,
    playbackId: v.playbackId,
    durationLabel: formatDuration(v.durationSeconds),
    providerAssetId: v.providerAssetId,
    errorMessage: v.errorMessage,
    source: v.source,
  };
}

export default async function LectureDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lectureId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { lectureId } = await params;
  const { created } = await searchParams;
  if (!UUID_RE.test(lectureId)) notFound();

  const { data, error } = await staff.supabase
    .from("lectures")
    .select("*, topics(id, title)")
    .eq("id", lectureId)
    .maybeSingle();
  if (error) {
    return <div className="error-box" role="alert">This lecture could not be loaded. Refresh the page to try again.</div>;
  }
  if (!data) notFound();
  const lecture = data as unknown as LectureWithTopic;

  const status = lecture.status as ContentStatus;
  const canPublish = staff.can("content.publish");
  // Editors may change drafts only. The database and the server actions enforce the same rule.
  const canEdit = status === "draft" || canPublish;

  const [readiness, topics, objectivesRes, resourcesRes] = await Promise.all([
    loadReadiness(staff.supabase, lecture),
    loadTopicOptions(staff.supabase),
    staff.supabase
      .from("lecture_objectives")
      .select("id, objective, sort_order")
      .eq("lecture_id", lectureId)
      .order("sort_order")
      .order("id"),
    staff.supabase
      .from("lecture_resources")
      .select("id, title, description, external_url, sort_order")
      .eq("lecture_id", lectureId)
      .order("sort_order")
      .order("id"),
  ]);

  const objectives = (objectivesRes.data ?? []) as unknown as { id: string; objective: string }[];
  const resources = (resourcesRes.data ?? []) as unknown as {
    id: string;
    title: string;
    description: string | null;
    external_url: string | null;
  }[];
  const previewHref = `/admin/lectures/${lecture.id}/preview`;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Lectures", href: "/admin/lectures" },
          ...(lecture.topics ? [{ label: lecture.topics.title, href: `/admin/topics/${lecture.topics.id}` }] : []),
          { label: lecture.title },
        ]}
      />
      <PageHeader
        title={lecture.title}
        description={`Lecture · ${lecture.slug}`}
        actions={
          <>
            <StatusBadge status={status} />
            <Link href={previewHref} className="secondary-button">Preview</Link>
          </>
        }
      />

      {created === "1" && (
        <div className="success-box" role="status" style={{ marginBottom: "1rem" }}>
          Draft lecture created. Now add its video, learning objectives and resources below.
        </div>
      )}

      <div className="admin-form-grid" style={{ maxWidth: "54rem" }}>
        <section className="surface-card" aria-labelledby="details-heading">
          <h2 id="details-heading" className="section-title admin-section-title">Lecture details</h2>
          {canEdit ? (
            <LectureForm
              mode="edit"
              lectureId={lecture.id}
              topics={topics}
              slugLocked={status !== "draft"}
              backHref={lecture.topics ? `/admin/topics/${lecture.topics.id}` : "/admin/lectures"}
              initial={{
                title: lecture.title,
                slug: lecture.slug,
                description: lecture.description ?? "",
                transcript: lecture.transcript ?? "",
                sortOrder: String(lecture.sort_order),
                topicId: lecture.topic_id,
              }}
            />
          ) : (
            <p className="muted-copy" role="status">This lecture is {status}. Only an administrator can edit it.</p>
          )}
          <p className="admin-stat-sub" style={{ marginTop: "1rem" }}>
            Created {formatDateTime(lecture.created_at)} · Updated {formatDateTime(lecture.updated_at)}
          </p>
        </section>

        <section className="surface-card" aria-labelledby="video-heading">
          <h2 id="video-heading" className="section-title admin-section-title">Video</h2>
          <VideoPanel
            lectureId={lecture.id}
            attached={toView(readiness.video.attached)}
            pending={toView(readiness.video.pending)}
            canChange={canEdit}
            muxConfigured={muxConfigured()}
            isPublished={status === "published"}
            previewHref={previewHref}
          />
        </section>

        <section className="surface-card" aria-labelledby="objectives-heading">
          <h2 id="objectives-heading" className="section-title admin-section-title">Learning objectives</h2>
          <ObjectivesEditor lectureId={lecture.id} objectives={objectives} canEdit={canEdit} />
        </section>

        <section className="surface-card" aria-labelledby="resources-heading">
          <h2 id="resources-heading" className="section-title admin-section-title">Resources</h2>
          <ResourcesEditor lectureId={lecture.id} resources={resources} canEdit={canEdit} />
        </section>

        {canPublish && (
          <section className="surface-card" aria-labelledby="status-heading">
            <h2 id="status-heading" className="section-title admin-section-title">Publication</h2>
            <p className="muted-copy" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              {status === "published"
                ? "This lecture is visible to students who have access."
                : status === "archived"
                  ? "This lecture is archived and hidden from students."
                  : "This lecture is a draft and hidden from students."}
            </p>
            <LectureStatusControls lectureId={lecture.id} status={status} missing={readiness.missing} />
          </section>
        )}

        {staff.can("content.delete") && status === "draft" && (
          <section className="surface-card" aria-labelledby="danger-heading">
            <h2 id="danger-heading" className="section-title admin-section-title">Delete</h2>
            <p className="muted-copy" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              Only draft lectures can be deleted. Its objectives and resources are deleted with it. Otherwise, archive it.
            </p>
            <DeleteLectureButton lectureId={lecture.id} title={lecture.title} />
          </section>
        )}

        <Link href={lecture.topics ? `/admin/topics/${lecture.topics.id}` : "/admin/lectures"} className="text-link">
          ← Back
        </Link>
      </div>
    </>
  );
}