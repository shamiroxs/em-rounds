"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { deleteAnnouncement } from "@/app/admin/announcements/actions";

export function DeleteAnnouncementButton({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteAnnouncement(id);
      if (result.ok) {
        toast.success("Announcement deleted.");
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
      <button type="button" className="secondary-button"
        style={{ color: "var(--danger-text)", borderColor: "var(--danger-border)" }} onClick={() => setOpen(true)}>
        Delete this announcement
      </button>
      <ConfirmDialog
        open={open}
        title="Delete this announcement permanently?"
        description={<>“{title}” will be permanently deleted. This cannot be undone.</>}
        confirmLabel="Delete permanently"
        destructive
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}