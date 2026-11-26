import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/admin/access";
import { UUID_RE } from "@/lib/learning";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { PageHeader } from "@/components/admin/ui";
import { SectionForm } from "@/components/admin/structure/section-form";

export const instant = false;

export default async function NewSubjectPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { courseId } = await params;
  if (!UUID_RE.test(courseId)) notFound();

  const { data: course, error } = await staff.supabase
    .from("courses")
    .select("id, title, status")
    .eq("id", courseId)
    .maybeSingle();
  if (error) {
    return <div className="error-box" role="alert">The course could not be loaded. Refresh to try again.</div>;
  }
  if (!course) notFound();

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Courses", href: "/admin/courses" },
          { label: course.title, href: `/admin/courses/${course.id}` },
          { label: "New subject" },
        ]}
      />
      <PageHeader
        title="New subject"
        description={`Added to “${course.title}” as a draft. An administrator publishes it.`}
      />
      {course.status === "archived" ? (
        <div className="error-box" role="alert">
          This course is archived. Restore it to a draft before adding subjects.
        </div>
      ) : (
        <div className="surface-card" style={{ maxWidth: "42rem" }}>
          <SectionForm
            kind="subject"
            mode="create"
            parentId={course.id}
            backHref={`/admin/courses/${course.id}`}
          />
        </div>
      )}
    </>
  );
}