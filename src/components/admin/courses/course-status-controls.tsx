"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { setCourseStatus } from "@/app/admin/courses/actions";
import type { ContentStatus } from "@/lib/admin/validation";

type Pending = { to: ContentStatus; label: string; title: string; body: string; destructive: boolean };

function optionsFor(status: ContentStatus): Pending[] {
  if (status === "draft") {
    return [
      { to: "published", label: "Publish", title: "Publish this course?",
        body: "Students will be able to see this course in the catalogue. Their access to its lessons still depends on what they have purchased.", destructive: false },
      { to: "archived", label: "Archive", title: "Archive this course?",
        body: "The course will be hidden from students. You can restore it to a draft later.", destructive: true },
    ];
  }
  if (status === "published") {
    return [
      { to: "draft", label: "Unpublish", title: "Unpublish this course?",
        body: "The course will disappear from the student catalogue immediately, including for students who already have access. It becomes a draft that you can publish again.", destructive: true },
      { to: "archived", label: "Archive", title: "Archive this course?",
        body: "The course will be hidden from every student. You can restore it to a draft later.", destructive: true },
    ];
  }
  return [
    { to: "draft", label: "Restore to draft", title: "Restore this course to a draft?",
      body: "The course stays hidden from students until you publish it again.", destructive: false },
  ];
}

export function CourseStatusControls({
  courseId,
  status,
  missing,
}: {
  courseId: string;
  status: ContentStatus;
  /** What the course still needs before it can be published (from the server). */
  missing: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, startTransition] = useTransition();
  const options = optionsFor(status);

  function confirm() {
    if (!pending) return;
    const target = pending;
    startTransition(async () => {
      const result = await setCourseStatus(courseId, target.to);
      if (result.ok) {
        toast.success(`${target.label} complete.`);
        setPending(null);
        router.refresh();
      } else {
        toast.error(result.error);
        setPending(null);
      }
    });
  }

  return (
    <div>
      {status === "draft" && missing.length > 0 && (
        <p className="field-hint" role="status" style={{ marginBottom: "0.8rem" }}>
          Before publishing, add {missing.join(" and ")}.
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {options.map((o) => (
          <button
            key={o.to}
            type="button"
            className={o.to === "published" ? "primary-button" : "secondary-button"}
            disabled={busy || (o.to === "published" && missing.length > 0)}
            onClick={() => setPending(o)}
          >
            {o.label}
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
