"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { setAnnouncementStatus } from "@/app/admin/announcements/actions";
import type { ContentStatus } from "@/lib/admin/validation";

type Pending = { to: ContentStatus; label: string; title: string; body: string; destructive: boolean };

function optionsFor(status: ContentStatus): Pending[] {
  if (status === "draft") {
    return [
      { to: "published", label: "Publish", title: "Publish this announcement?",
        body: "It becomes visible to signed-in students (at the scheduled time, if you set one).", destructive: false },
      { to: "archived", label: "Archive", title: "Archive this announcement?",
        body: "It will be hidden. You can restore it to a draft later.", destructive: true },
    ];
  }
  if (status === "published") {
    return [
      { to: "draft", label: "Unpublish", title: "Unpublish this announcement?",
        body: "It is hidden from students immediately and becomes a draft.", destructive: true },
      { to: "archived", label: "Archive", title: "Archive this announcement?",
        body: "It will be hidden. You can restore it to a draft later.", destructive: true },
    ];
  }
  return [
    { to: "draft", label: "Restore to draft", title: "Restore this announcement to a draft?",
      body: "It stays hidden until you publish it again.", destructive: false },
  ];
}

export function AnnouncementStatusControls({ id, status }: { id: string; status: ContentStatus }) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, startTransition] = useTransition();
  const options = optionsFor(status);

  function confirm() {
    if (!pending) return;
    const target = pending;
    startTransition(async () => {
      const result = await setAnnouncementStatus(id, target.to);
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
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        {options.map((o) => (
          <button key={o.to} type="button" className={o.to === "published" ? "primary-button" : "secondary-button"}
            disabled={busy} onClick={() => setPending(o)}>
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