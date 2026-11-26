"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { deleteSection, type SectionKind } from "@/app/admin/structure/actions";

export function DeleteSectionButton({
  kind,
  id,
  title,
}: {
  kind: SectionKind;
  id: string;
  title: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteSection(kind, id);
      if (result.ok) {
        toast.success(`${kind === "subject" ? "Subject" : "Topic"} deleted.`);
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
        Delete this draft {kind}
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete this ${kind} permanently?`}
        description={
          <>
            “{title}” will be permanently deleted. This cannot be undone. Only empty drafts can be
            deleted; anything with content inside must be archived instead.
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