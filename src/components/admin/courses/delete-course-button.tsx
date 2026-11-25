"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { deleteCourse } from "@/app/admin/courses/actions";

export function DeleteCourseButton({ courseId, title }: { courseId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteCourse(courseId);
      if (result.ok) {
        toast.success("Course deleted.");
        router.push("/admin/courses");
        router.refresh();
      } else {
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button type="button" className="secondary-button" style={{ color: "var(--danger-text)", borderColor: "var(--danger-border)" }} onClick={() => setOpen(true)}>
        Delete this draft course
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this course permanently?"
        description={
          <>
            “{title}” will be permanently deleted. This cannot be undone. Only empty draft
            courses can be deleted; anything else must be archived instead.
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
