import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { UUID_RE } from "@/lib/learning";
import { courseMissingForPublish, type ContentStatus } from "@/lib/admin/validation";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";
import { CourseForm } from "@/components/admin/courses/course-form";
import { CourseStatusControls } from "@/components/admin/courses/course-status-controls";
import { DeleteCourseButton } from "@/components/admin/courses/delete-course-button";
import { ReorderButtons } from "@/components/admin/structure/reorder-buttons";

export const instant = false;

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { courseId } = await params;
  const { created } = await searchParams;
  if (!UUID_RE.test(courseId)) notFound();

  const { data: course, error } = await staff.supabase
    .from("courses")
    .select("id, slug, title, description, status, sort_order, created_at, updated_at")
    .eq("id", courseId)
    .maybeSingle();

  if (error) {
    return (
      <div className="error-box" role="alert">
        This course could not be loaded. Refresh the page to try again.
      </div>
    );
  }
  if (!course) notFound();

  const status = course.status as ContentStatus;
  const canPublish = staff.can("content.publish");
  // Editors may change drafts only. The database enforces the same rule.
  const canEdit = status === "draft" || canPublish;

  const { data: subjects, error: subjectsError } = await staff.supabase
    .from("subjects")
    .select("id, title, slug, status, sort_order, topics(count)")
    .eq("course_id", courseId)
    .order("sort_order")
    .order("title")
    .order("id");

  return (
    <>
      <PageHeader
        title={course.title}
        description={`/learn/${course.slug}`}
        actions={<StatusBadge status={status} />}
      />

      {created === "1" && (
        <div className="success-box" role="status" style={{ marginBottom: "1rem" }}>
          Draft course created.
        </div>
      )}

      <div className="admin-form-grid" style={{ maxWidth: "52rem" }}>
        <section className="surface-card" aria-labelledby="details-heading">
          <h2 id="details-heading" className="section-title admin-section-title">Course details</h2>
          {canEdit ? (
            <CourseForm
              mode="edit"
              courseId={course.id}
              slugLocked={status !== "draft"}
              initial={{
                title: course.title,
                slug: course.slug,
                description: course.description ?? "",
                sortOrder: String(course.sort_order),
              }}
            />
          ) : (
            <p className="muted-copy" role="status">
              This course is {status}. Only an administrator can edit it.
            </p>
          )}
          <p className="admin-stat-sub" style={{ marginTop: "1rem" }}>
            Created {formatDateTime(course.created_at)} · Updated {formatDateTime(course.updated_at)}
          </p>
        </section>

        {canPublish && (
          <section className="surface-card" aria-labelledby="status-heading">
            <h2 id="status-heading" className="section-title admin-section-title">Publication</h2>
            <p className="muted-copy" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              {status === "published"
                ? "This course is visible to students."
                : status === "archived"
                  ? "This course is archived and hidden from students."
                  : "This course is a draft and hidden from students."}
            </p>
            <CourseStatusControls
              courseId={course.id}
              status={status}
              missing={courseMissingForPublish(course)}
            />
          </section>
        )}

        <section className="surface-card" aria-labelledby="subjects-heading">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.8rem", marginBottom: "0.8rem" }}>
            <h2 id="subjects-heading" className="section-title admin-section-title" style={{ margin: 0 }}>
              Subjects in this course
            </h2>
            {status !== "archived" && (
              <Link href={`/admin/courses/${course.id}/subjects/new`} className="primary-button">
                <Plus size={18} aria-hidden style={{ marginRight: "0.4rem" }} /> Add subject
              </Link>
            )}
          </div>
          {subjectsError ? (
            <div className="error-box" role="alert">Subjects could not be loaded. Refresh the page to try again.</div>
          ) : !subjects || subjects.length === 0 ? (
            <EmptyState title="No subjects yet" description="Add the first subject to start building this course." />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Subject</th>
                    <th scope="col">Status</th>
                    <th scope="col">Topics</th>
                    <th scope="col">Order</th>
                    {canPublish && <th scope="col">Move</th>}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((s, i) => {
                    const topicCount =
                      (s.topics as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
                    return (
                      <tr key={s.id}>
                        <td>
                          <Link href={`/admin/subjects/${s.id}`} className="text-link">{s.title}</Link>
                          <div className="admin-stat-sub">{s.slug}</div>
                        </td>
                        <td><StatusBadge status={s.status} /></td>
                        <td>{topicCount}</td>
                        <td>{s.sort_order}</td>
                        {canPublish && (
                          <td>
                            <ReorderButtons
                              kind="subject"
                              id={s.id}
                              title={s.title}
                              isFirst={i === 0}
                              isLast={i === subjects.length - 1}
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
              Only empty draft courses can be deleted. If this course has subjects or has ever been
              linked to a purchase, archive it instead.
            </p>
            <DeleteCourseButton courseId={course.id} title={course.title} />
          </section>
        )}

        <Link href="/admin/courses" className="text-link">← Back to all courses</Link>
      </div>
    </>
  );
}