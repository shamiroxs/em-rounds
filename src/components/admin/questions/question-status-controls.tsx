"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { publishQuestion, setQuestionStatus } from "@/app/admin/questions/actions";

type Choice = {
  key: string;
  label: string;
  title: string;
  body: string;
  destructive: boolean;
  primary: boolean;
  run: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

export function QuestionStatusControls({
  questionId,
  status,
  latestVersionNumber,
  latestVersionStatus,
  missing,
}: {
  questionId: string;
  status: "draft" | "published" | "archived";
  latestVersionNumber: number;
  latestVersionStatus: string;
  missing: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Choice | null>(null);
  const [busy, startTransition] = useTransition();

  const hasNewerDraft = latestVersionStatus === "draft";
  const choices: Choice[] = [];

  if (status === "draft" || (status === "published" && hasNewerDraft)) {
    choices.push({
      key: "publish",
      label: status === "published" ? `Publish version ${latestVersionNumber}` : "Publish",
      title: "Publish this question?",
      body:
        status === "published"
          ? `Version ${latestVersionNumber} replaces the currently published version for students. The earlier version is kept in the history.`
          : "Students with access will be able to answer it, as long as its topic, subject and course are published. Published versions can never be edited; changes create a new version.",
      destructive: false,
      primary: true,
      run: () => publishQuestion(questionId),
    });
  }
  if (status === "published") {
    choices.push({
      key: "unpublish",
      label: "Unpublish",
      title: "Unpublish this question?",
      body: "Students will no longer see it. Its version history is kept, and you can publish it again later.",
      destructive: true,
      primary: false,
      run: () => setQuestionStatus(questionId, "draft"),
    });
  }
  if (status !== "archived") {
    choices.push({
      key: "archive",
      label: "Archive",
      title: "Archive this question?",
      body: "The question is hidden from students and from editing. You can restore it to a draft later.",
      destructive: true,
      primary: false,
      run: () => setQuestionStatus(questionId, "archived"),
    });
  } else {
    choices.push({
      key: "restore",
      label: "Restore to draft",
      title: "Restore this question to a draft?",
      body: "It stays hidden from students until you publish it again.",
      destructive: false,
      primary: false,
      run: () => setQuestionStatus(questionId, "draft"),
    });
  }

  function confirm() {
    if (!pending) return;
    const target = pending;
    startTransition(async () => {
      const result = await target.run();
      if (result.ok) {
        toast.success(`${target.label} complete.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setPending(null);
    });
  }

  return (
    <div>
      {(status === "draft" || hasNewerDraft) && status !== "archived" && (
        <div style={{ marginBottom: "1rem" }}>
          <p className="field-label" style={{ marginBottom: "0.4rem" }}>Before this question can be published</p>
          {missing.length === 0 ? (
            <p className="success-box" role="status">Everything required is in place.</p>
          ) : (
            <ul className="muted-copy" style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.92rem" }}>
              {missing.map((m) => (<li key={m}>Add {m}</li>))}
            </ul>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {choices.map((c) => (
          <button
            key={c.key}
            type="button"
            className={c.primary ? "primary-button" : "secondary-button"}
            disabled={busy || (c.key === "publish" && missing.length > 0)}
            onClick={() => setPending(c)}
          >
            {c.label}
          </button>
        ))}
      </div>
      <ConfirmDialog
        open={pending !== null}
        title={pending?.title ?? ""}
        description={pending?.body ?? ""}
        confirmLabel={pending?.label ?? "Confirm"}
        destructive={pending?.destructive ?? false}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}