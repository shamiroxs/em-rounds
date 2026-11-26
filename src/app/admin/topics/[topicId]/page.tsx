import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { UUID_RE } from "@/lib/learning";
import { sectionMissingForPublish, type ContentStatus } from "@/lib/admin/validation";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";
import { SectionForm } from "@/components/admin/structure/section-form";
import { SectionStatusControls } from "@/components/admin/structure/section-status-controls";
import { DeleteSectionButton } from "@/components/admin/structure/delete-section-button";

export const instant = false;

type SubjectEmbed = {
  id: string;
  title: string;
  status: string;
  course_id: string;
  courses: { id: string; title: string } | null;
};

export default async function TopicDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ topicId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { topicId } = await params;
  const { created } = await searchParams;
  if (!UUID_RE.test(topicId)) notFound();

  const { data: topic, error } = await staff.supabase
    .from("topics")
    .select("id, subject_id, slug, title, description, status, sort_order, created_at, updated_at, subjects(id, title, status, course_id, courses(id, title))")
    .eq("id", topicId)
    .maybeSingle();
  if (error) {
    return <div className="error-box" role="alert">This topic could not be loaded. Refresh the page to try again.</div>;
  }
  if (!topic) notFound();

  const subject = topic.subjects as unknown as SubjectEmbed | null;
  const course = subject?.courses ?? null;
  const status = topic.status as ContentStatus;
  const canPublish = staff.can("content.publish");
  const canEdit = status === "draft" || canPublish;

  const { data: lectures, error: lecturesError } = await staff.supabase
    .from("lectures")
    .select("id, title, status, sort_order")
    .eq("topic_id", topicId)
    .order("sort_order")
    .order("title")
    .order("id");

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Courses", href: "/admin/courses" },
          { label: course?.title ?? "Course", href: subject ? `/admin/courses/${subject.course_id}` : "/admin/courses" },
          { label: subject?.title ?? "Subject", href: `/admin/subjects/${topic.subject_id}` },
          { label: topic.title },
        ]}
      />
      <PageHeader
        title={topic.title}
        description={`Topic · ${topic.slug}`}
        actions={<StatusBadge status={status} />}
      />

      {created === "1" && (
        <div className="success-box" role="status" style={{ marginBottom: "1rem" }}>
          Draft topic created.
        </div>
      )}

      <div className="admin-form-grid" style={{ maxWidth: "52rem" }}>
        <section className="surface-card" aria-labelledby="details-heading">
          <h2 id="details-heading" className="section-title admin-section-title">Topic details</h2>
          {canEdit ? (
            <SectionForm
              kind="topic"
              mode="edit"
              id={topic.id}
              slugLocked={status !== "draft"}
              backHref={`/admin/subjects/${topic.subject_id}`}
              initial={{
                title: topic.title,
                slug: topic.slug,
                description: topic.description ?? "",
                sortOrder: String(topic.sort_order),
              }}
            />
          ) : (
            <p className="muted-copy" role="status">
              This topic is {status}. Only an administrator can edit it.
            </p>
          )}
          <p className="admin-stat-sub" style={{ marginTop: "1rem" }}>
            Created {formatDateTime(topic.created_at)} · Updated {formatDateTime(topic.updated_at)}
          </p>
        </section>

        {canPublish && (
          <section className="surface-card" aria-labelledby="status-heading">
            <h2 id="status-heading" className="section-title admin-section-title">Publication</h2>
            <p className="muted-copy" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              {status === "published"
                ? "This topic is visible to students (when its subject and course are published)."
                : status === "archived"
                  ? "This topic is archived and hidden from students."
                  : "This topic is a draft and hidden from students."}
            </p>
            <SectionStatusControls
              kind="topic"
              id={topic.id}
              status={status}
              missing={sectionMissingForPublish(topic)}
            />
          </section>
        )}

        <section className="surface-card" aria-labelledby="lectures-heading">
          <h2 id="lectures-heading" className="section-title admin-section-title">Lectures in this topic</h2>
          {lecturesError ? (
            <div className="error-box" role="alert">Lectures could not be loaded. Refresh the page to try again.</div>
          ) : !lectures || lectures.length === 0 ? (
            <EmptyState title="No lectures yet" description="Lecture management is added in the next module." />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th scope="col">Lecture</th><th scope="col">Status</th><th scope="col">Order</th></tr>
                </thead>
                <tbody>
                  {lectures.map((l) => (
                    <tr key={l.id}>
                      <td>{l.title}</td>
                      <td><StatusBadge status={l.status} /></td>
                      <td>{l.sort_order}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {staff.can("content.delete") && status === "draft" && (
          <section className="surface-card" aria-labelledby="danger-heading">
            <h2 id="danger-heading" className="section-title admin-section-title">Delete</h2>
            <p className="muted-copy" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              Only a topic with no lectures, questions or sub-topics can be deleted. Otherwise, archive it.
            </p>
            <DeleteSectionButton kind="topic" id={topic.id} title={topic.title} />
          </section>
        )}

        <Link href={`/admin/subjects/${topic.subject_id}`} className="text-link">← Back to the subject</Link>
      </div>
    </>
  );
}