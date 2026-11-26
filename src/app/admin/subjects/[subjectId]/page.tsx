import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { UUID_RE } from "@/lib/learning";
import { sectionMissingForPublish, type ContentStatus } from "@/lib/admin/validation";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";
import { SectionForm } from "@/components/admin/structure/section-form";
import { SectionStatusControls } from "@/components/admin/structure/section-status-controls";
import { DeleteSectionButton } from "@/components/admin/structure/delete-section-button";
import { ReorderButtons } from "@/components/admin/structure/reorder-buttons";

export const instant = false;

export default async function SubjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ subjectId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { subjectId } = await params;
  const { created } = await searchParams;
  if (!UUID_RE.test(subjectId)) notFound();

  const { data, error } = await staff.supabase
    .from("subjects")
    .select("id, course_id, slug, title, description, status, sort_order, created_at, updated_at, courses(id, title, status)")
    .eq("id", subjectId)
    .maybeSingle();
  if (error) {
    return <div className="error-box" role="alert">This subject could not be loaded. Refresh the page to try again.</div>;
  }
  if (!data) notFound();

  const subject = data;
  const course = subject.courses as unknown as { id: string; title: string; status: string } | null;
  const status = subject.status as ContentStatus;
  const canPublish = staff.can("content.publish");
  const canEdit = status === "draft" || canPublish;

  const { data: topics, error: topicsError } = await staff.supabase
    .from("topics")
    .select("id, title, slug, status, sort_order, lectures(count)")
    .eq("subject_id", subjectId)
    .order("sort_order")
    .order("title")
    .order("id");

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Courses", href: "/admin/courses" },
          { label: course?.title ?? "Course", href: `/admin/courses/${subject.course_id}` },
          { label: subject.title },
        ]}
      />
      <PageHeader
        title={subject.title}
        description={`Subject · ${subject.slug}`}
        actions={<StatusBadge status={status} />}
      />

      {created === "1" && (
        <div className="success-box" role="status" style={{ marginBottom: "1rem" }}>
          Draft subject created.
        </div>
      )}
      {course && course.status !== "published" && status === "published" && (
        <div className="error-box" role="status" style={{ marginBottom: "1rem" }}>
          This subject is published, but its course is {course.status}, so students cannot see it yet.
        </div>
      )}

      <div className="admin-form-grid" style={{ maxWidth: "52rem" }}>
        <section className="surface-card" aria-labelledby="details-heading">
          <h2 id="details-heading" className="section-title admin-section-title">Subject details</h2>
          {canEdit ? (
            <SectionForm
              kind="subject"
              mode="edit"
              id={subject.id}
              slugLocked={status !== "draft"}
              backHref={`/admin/courses/${subject.course_id}`}
              initial={{
                title: subject.title,
                slug: subject.slug,
                description: subject.description ?? "",
                sortOrder: String(subject.sort_order),
              }}
            />
          ) : (
            <p className="muted-copy" role="status">
              This subject is {status}. Only an administrator can edit it.
            </p>
          )}
          <p className="admin-stat-sub" style={{ marginTop: "1rem" }}>
            Created {formatDateTime(subject.created_at)} · Updated {formatDateTime(subject.updated_at)}
          </p>
        </section>

        {canPublish && (
          <section className="surface-card" aria-labelledby="status-heading">
            <h2 id="status-heading" className="section-title admin-section-title">Publication</h2>
            <p className="muted-copy" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              {status === "published"
                ? "This subject is visible to students (when its course is published)."
                : status === "archived"
                  ? "This subject is archived and hidden from students."
                  : "This subject is a draft and hidden from students."}
            </p>
            <SectionStatusControls
              kind="subject"
              id={subject.id}
              status={status}
              missing={sectionMissingForPublish(subject)}
            />
          </section>
        )}

        <section className="surface-card" aria-labelledby="topics-heading">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.8rem", marginBottom: "0.8rem" }}>
            <h2 id="topics-heading" className="section-title admin-section-title" style={{ margin: 0 }}>Topics</h2>
            {status !== "archived" && (
              <Link href={`/admin/subjects/${subject.id}/topics/new`} className="primary-button">
                <Plus size={18} aria-hidden style={{ marginRight: "0.4rem" }} /> Add topic
              </Link>
            )}
          </div>
          {topicsError ? (
            <div className="error-box" role="alert">Topics could not be loaded. Refresh the page to try again.</div>
          ) : !topics || topics.length === 0 ? (
            <EmptyState title="No topics yet" description="Add the first topic to start organizing lectures." />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Topic</th>
                    <th scope="col">Status</th>
                    <th scope="col">Lectures</th>
                    <th scope="col">Order</th>
                    {canPublish && <th scope="col">Move</th>}
                  </tr>
                </thead>
                <tbody>
                  {topics.map((t, i) => {
                    const lectureCount =
                      (t.lectures as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
                    return (
                      <tr key={t.id}>
                        <td>
                          <Link href={`/admin/topics/${t.id}`} className="text-link">{t.title}</Link>
                          <div className="admin-stat-sub">{t.slug}</div>
                        </td>
                        <td><StatusBadge status={t.status} /></td>
                        <td>{lectureCount}</td>
                        <td>{t.sort_order}</td>
                        {canPublish && (
                          <td>
                            <ReorderButtons
                              kind="topic"
                              id={t.id}
                              title={t.title}
                              isFirst={i === 0}
                              isLast={i === topics.length - 1}
                            />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {staff.can("content.delete") && status === "draft" && (
          <section className="surface-card" aria-labelledby="danger-heading">
            <h2 id="danger-heading" className="section-title admin-section-title">Delete</h2>
            <p className="muted-copy" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              Only a subject with no topics can be deleted. Otherwise, archive it.
            </p>
            <DeleteSectionButton kind="subject" id={subject.id} title={subject.title} />
          </section>
        )}

        <Link href={`/admin/courses/${subject.course_id}`} className="text-link">← Back to the course</Link>
      </div>
    </>
  );
}