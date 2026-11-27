import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { UUID_RE } from "@/lib/learning";
import { loadTopicOptions } from "@/lib/admin/lecture-data";
import { loadQuestionEditorData, loadTagOptions } from "@/lib/admin/question-data";
import { questionMissingForPublish } from "@/lib/admin/question-validation";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { QuestionEditor } from "@/components/admin/questions/question-editor";
import { QuestionStatusControls } from "@/components/admin/questions/question-status-controls";

export const instant = false;

export default async function QuestionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ questionId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { questionId } = await params;
  const { created } = await searchParams;
  if (!UUID_RE.test(questionId)) notFound();

  let data, topics, tags;
  try {
    [data, topics, tags] = await Promise.all([
      loadQuestionEditorData(staff, questionId),
      loadTopicOptions(staff.supabase),
      loadTagOptions(staff.supabase),
    ]);
  } catch {
    return <div className="error-box" role="alert">This question could not be loaded. Refresh the page to try again.</div>;
  }
  if (!data) notFound();

  const { question, latest, options, versions } = data;
  const status = question.status;
  const canPublish = staff.can("content.publish");
  // Editors may change drafts only. The server actions and the database enforce the same rule.
  const canEdit = status !== "archived" && (status === "draft" || canPublish);
  const topic = topics.find((t) => t.id === question.topic_id);

  const missing = questionMissingForPublish({
    stem: latest.stem,
    optionCount: options.length,
    hasCorrect: data.correctIndex >= 0,
    explanation: data.explanation,
  });

  const willCreateVersion = latest.status !== "draft";
  const banner = willCreateVersion
    ? `Version ${latest.version_number} is ${latest.status} and cannot be edited. Saving creates version ${latest.version_number + 1} as a new draft. Students keep seeing the current version until an administrator publishes the new one.`
    : latest.version_number > 1
      ? `You are editing draft version ${latest.version_number}.`
      : undefined;

  return (
    <>
      <Breadcrumbs items={[{ label: "Questions", href: "/admin/questions" }, { label: question.question_code ?? "Question" }]} />
      <PageHeader
        title={question.question_code ? `Question ${question.question_code}` : "Question"}
        description={topic ? topic.label : undefined}
        actions={<StatusBadge status={status} />}
      />

      {created === "1" && (
        <div className="success-box" role="status" style={{ marginBottom: "1rem" }}>Draft question created.</div>
      )}
      {data.correctIndex < 0 && (
        <div className="error-box" role="alert" style={{ marginBottom: "1rem" }}>
          No correct answer is stored for this version. Select one and save before publishing.
        </div>
      )}

      <div className="admin-form-grid" style={{ maxWidth: "54rem" }}>
        <section className="surface-card" aria-labelledby="editor-heading">
          <h2 id="editor-heading" className="section-title admin-section-title">
            {canEdit ? "Edit question" : "Question"}
          </h2>
          {canEdit ? (
            <QuestionEditor
              key={`${latest.id}-${question.updated_at}`}
              questionId={question.id}
              topics={topics}
              tags={tags}
              banner={banner}
              backHref="/admin/questions"
              initial={{
                topicId: question.topic_id,
                code: question.question_code ?? "",
                stem: latest.stem,
                difficulty: latest.difficulty,
                options: options.map((o) => o.text),
                correctIndex: data.correctIndex,
                explanation: data.explanation,
                tagIds: data.tagIds,
              }}
            />
          ) : (
            <p className="muted-copy" role="status">
              {status === "archived"
                ? "This question is archived. An administrator can restore it to a draft to edit it."
                : "This question is published. Only an administrator can edit it."}
            </p>
          )}
        </section>

        <section className="surface-card" aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="section-title admin-section-title">
            Preview, with answer key <span className="admin-badge" style={{ marginLeft: "0.5rem" }}>Staff only</span>
          </h2>
          <p style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{latest.stem}</p>
          <ul style={{ listStyle: "none", margin: "0 0 1rem", padding: 0, display: "grid", gap: "0.5rem" }}>
            {options.map((o, i) => (
              <li key={o.id} style={{
                display: "flex", gap: "0.6rem", alignItems: "flex-start", padding: "0.6rem 0.8rem",
                border: "1px solid var(--border)", borderRadius: "0.7rem",
                background: i === data.correctIndex ? "var(--success-bg)" : "var(--surface)",
              }}>
                <strong>{o.label}</strong>
                <span style={{ flex: 1 }}>{o.text}</span>
                {i === data.correctIndex && <Check size={18} aria-label="Correct answer" />}
              </li>
            ))}
          </ul>
          {data.explanation ? (
            <>
              <p className="field-label">Explanation</p>
              <p className="muted-copy" style={{ whiteSpace: "pre-wrap", marginTop: 0 }}>{data.explanation}</p>
            </>
          ) : (
            <p className="muted-copy">No explanation yet.</p>
          )}
        </section>

        {canPublish && (
          <section className="surface-card" aria-labelledby="status-heading">
            <h2 id="status-heading" className="section-title admin-section-title">Publication</h2>
            <p className="muted-copy" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              {status === "published"
                ? "This question is live for students who have access."
                : status === "archived"
                  ? "This question is archived and hidden from students."
                  : "This question is a draft and hidden from students."}
            </p>
            <QuestionStatusControls
              questionId={question.id}
              status={status}
              latestVersionNumber={latest.version_number}
              latestVersionStatus={latest.status}
              missing={missing}
            />
          </section>
        )}

        <section className="surface-card" aria-labelledby="history-heading">
          <h2 id="history-heading" className="section-title admin-section-title">Version history</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Version</th>
                  <th scope="col">Status</th>
                  <th scope="col">Difficulty</th>
                  <th scope="col">Created</th>
                  <th scope="col">Published</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id}>
                    <td>v{v.version_number}</td>
                    <td><StatusBadge status={v.status} /></td>
                    <td style={{ textTransform: "capitalize" }}>{v.difficulty}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(v.created_at)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(v.published_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <Link href="/admin/questions" className="text-link">← Back to all questions</Link>
      </div>
    </>
  );
}