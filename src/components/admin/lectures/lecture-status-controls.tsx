"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { setLectureStatus } from "@/app/admin/lectures/actions";
import type { ContentStatus } from "@/lib/admin/validation";

type Pending = { to: ContentStatus; label: string; title: string; body: string; destructive: boolean };

function optionsFor(status: ContentStatus): Pending[] {
  if (status === "draft") {
    return [
      { to: "published", label: "Publish", title: "Publish this lecture?",
        body: "Students with access will be able to watch it, as long as its topic, subject and course are published.", destructive: false },
      { to: "archived", label: "Archive", title: "Archive this lecture?",
        body: "The lecture will be hidden from students. You can restore it to a draft later.", destructive: true },
    ];
  }
  if (status === "published") {
    return [
      { to: "draft", label: "Unpublish", title: "Unpublish this lecture?",
        body: "It disappears from the student area immediately, including for students already watching. It becomes a draft you can publish again.", destructive: true },
      { to: "archived", label: "Archive", title: "Archive this lecture?",
        body: "The lecture is hidden from every student. You can restore it to a draft later.", destructive: true },
    ];
  }
  return [
    { to: "draft", label: "Restore to draft", title: "Restore this lecture to a draft?",
      body: "It stays hidden from students until you publish it again.", destructive: false },
  ];
}

export function LectureStatusControls({
  lectureId,
  status,
  missing,
}: {
  lectureId: string;
  status: ContentStatus;
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
      const result = await setLectureStatus(lectureId, target.to);
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
      {status === "draft" && (
        <div style={{ marginBottom: "1rem" }}>
          <p className="field-label" style={{ marginBottom: "0.4rem" }}>Before this lecture can be published</p>
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