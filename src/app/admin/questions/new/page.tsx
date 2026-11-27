import { requireCapability } from "@/lib/admin/access";
import { UUID_RE } from "@/lib/learning";
import { loadTopicOptions } from "@/lib/admin/lecture-data";
import { loadTagOptions } from "@/lib/admin/question-data";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { PageHeader } from "@/components/admin/ui";
import { QuestionEditor } from "@/components/admin/questions/question-editor";

export const instant = false;

export default async function NewQuestionPage({
  searchParams,
}: {
  searchParams: Promise<{ topicId?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { topicId } = await searchParams;

  let topics, tags;
  try {
    [topics, tags] = await Promise.all([loadTopicOptions(staff.supabase), loadTagOptions(staff.supabase)]);
  } catch {
    return <div className="error-box" role="alert">The form could not be loaded. Refresh the page to try again.</div>;
  }
  const preselected = topicId && UUID_RE.test(topicId) && topics.some((t) => t.id === topicId) ? topicId : "";

  return (
    <>
      <Breadcrumbs items={[{ label: "Questions", href: "/admin/questions" }, { label: "New question" }]} />
      <PageHeader
        title="New question"
        description="Single best answer. The question is saved as a draft; an administrator publishes it."
      />
      {topics.length === 0 ? (
        <div className="error-box" role="status">Create a course, subject and topic first. Questions belong to topics.</div>
      ) : (
        <div className="surface-card" style={{ maxWidth: "48rem" }}>
          <QuestionEditor
            questionId={null}
            topics={topics}
            tags={tags}
            backHref="/admin/questions"
            initial={{
              topicId: preselected,
              code: "",
              stem: "",
              difficulty: "unclassified",
              options: ["", "", "", ""],
              correctIndex: -1,
              explanation: "",
              tagIds: [],
            }}
          />
        </div>
      )}
    </>
  );
}