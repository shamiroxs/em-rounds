"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { deleteLecture } from "@/app/admin/lectures/actions";

export function DeleteLectureButton({ lectureId, title }: { lectureId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteLecture(lectureId);
      if (result.ok) {
        toast.success("Lecture deleted.");
        router.push(result.redirectTo);
        router.refresh();
      } else {
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="secondary-button"
        style={{ color: "var(--danger-text)", borderColor: "var(--danger-border)" }}
        onClick={() => setOpen(true)}
      >
        Delete this draft lecture
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this lecture permanently?"
        description={
          <>
            “{title}” and its learning objectives and resources will be permanently deleted. This
            cannot be undone. The video file itself stays in Mux.
          </>
        }
        confirmLabel="Delete permanently"
        destructive
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}