import { requireCapability } from "@/lib/admin/access";
import { UUID_RE } from "@/lib/learning";
import { loadTopicOptions } from "@/lib/admin/lecture-data";
import { PageHeader } from "@/components/admin/ui";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { LectureForm } from "@/components/admin/lectures/lecture-form";

export const instant = false;

export default async function NewLecturePage({
  searchParams,
}: {
  searchParams: Promise<{ topicId?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { topicId } = await searchParams;

  let topics;
  try {
    topics = await loadTopicOptions(staff.supabase);
  } catch {
    return <div className="error-box" role="alert">Topics could not be loaded. Refresh the page to try again.</div>;
  }
  const preselected = topicId && UUID_RE.test(topicId) && topics.some((t) => t.id === topicId) ? topicId : "";

  return (
    <>
      <Breadcrumbs items={[{ label: "Lectures", href: "/admin/lectures" }, { label: "New lecture" }]} />
      <PageHeader
        title="New lecture"
        description="The lecture is saved as a draft. After saving you can add the video, objectives and resources."
      />
      {topics.length === 0 ? (
        <div className="error-box" role="status">Create a course, subject and topic first. Lectures live inside topics.</div>
      ) : (
        <div className="surface-card" style={{ maxWidth: "46rem" }}>
          <LectureForm
            mode="create"
            topics={topics}
            backHref="/admin/lectures"
            initial={{ title: "", slug: "", description: "", transcript: "", sortOrder: "0", topicId: preselected }}
          />
        </div>
      )}
    </>
  );
}