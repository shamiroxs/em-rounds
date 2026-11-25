import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { isContentStatus } from "@/lib/admin/validation";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";

export const instant = false;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
] as const;

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { status } = await searchParams;
  const filter = isContentStatus(status) ? status : "all";

  let query = staff.supabase
    .from("courses")
    .select("id, slug, title, status, sort_order, updated_at, subjects(count)")
    .order("sort_order")
    .order("title");
  if (filter !== "all") query = query.eq("status", filter);
  const { data: courses, error } = await query;

  return (
    <>
      <PageHeader
        title="Courses"
        description="Create and manage courses. New courses start as drafts; an administrator publishes them."
        actions={
          <Link href="/admin/courses/new" className="primary-button">
            <Plus size={18} aria-hidden style={{ marginRight: "0.4rem" }} /> New course
          </Link>
        }
      />

      <nav aria-label="Filter courses by status" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/admin/courses" : `/admin/courses?status=${f.key}`}
            className="admin-nav-link"
            aria-current={filter === f.key ? "page" : undefined}
            style={{ width: "auto" }}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className="error-box" role="alert">
          Courses could not be loaded. Refresh the page to try again.
        </div>
      ) : !courses || courses.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No courses yet" : `No ${filter} courses`}
          description={filter === "all" ? "Create your first course to start building the learning platform." : "Try a different filter."}
          action={
            filter === "all" ? (
              <Link href="/admin/courses/new" className="primary-button">Create a course</Link>
            ) : undefined
          }
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Course</th>
                <th scope="col">Status</th>
                <th scope="col">Subjects</th>
                <th scope="col">Order</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => {
                const subjectCount =
                  (c.subjects as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/courses/${c.id}`} className="text-link">{c.title}</Link>
                      <div className="admin-stat-sub">/learn/{c.slug}</div>
                    </td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{subjectCount}</td>
                    <td>{c.sort_order}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(c.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
