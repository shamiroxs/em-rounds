import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/admin/access";
import { UUID_RE } from "@/lib/learning";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { PageHeader } from "@/components/admin/ui";
import { SectionForm } from "@/components/admin/structure/section-form";

export const instant = false;

export default async function NewTopicPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { subjectId } = await params;
  if (!UUID_RE.test(subjectId)) notFound();

  const { data: subject, error } = await staff.supabase
    .from("subjects")
    .select("id, title, status, course_id, courses(id, title)")
    .eq("id", subjectId)
    .maybeSingle();
  if (error) {
    return <div className="error-box" role="alert">The subject could not be loaded. Refresh to try again.</div>;
  }
  if (!subject) notFound();
  const course = subject.courses as unknown as { id: string; title: string } | null;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: "Courses", href: "/admin/courses" },
          { label: course?.title ?? "Course", href: `/admin/courses/${subject.course_id}` },
          { label: subject.title, href: `/admin/subjects/${subject.id}` },
          { label: "New topic" },
        ]}
      />
      <PageHeader
        title="New topic"
        description={`Added to “${subject.title}” as a draft. An administrator publishes it.`}
      />
      {subject.status === "archived" ? (
        <div className="error-box" role="alert">
          This subject is archived. Restore it to a draft before adding topics.
        </div>
      ) : (
        <div className="surface-card" style={{ maxWidth: "42rem" }}>
          <SectionForm
            kind="topic"
            mode="create"
            parentId={subject.id}
            backHref={`/admin/subjects/${subject.id}`}
          />
        </div>
      )}
    </>
  );
}