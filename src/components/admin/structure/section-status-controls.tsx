"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { setSectionStatus, type SectionKind } from "@/app/admin/structure/actions";
import type { ContentStatus } from "@/lib/admin/validation";

type Pending = { to: ContentStatus; label: string; title: string; body: string; destructive: boolean };

function optionsFor(kind: SectionKind, status: ContentStatus): Pending[] {
  const n = kind;
  const inside = kind === "subject" ? "Its topics and lectures" : "Its lectures";
  if (status === "draft") {
    return [
      { to: "published", label: "Publish", title: `Publish this ${n}?`,
        body: `Students will be able to see this ${n}, as long as everything above it is also published.`, destructive: false },
      { to: "archived", label: "Archive", title: `Archive this ${n}?`,
        body: `The ${n} will be hidden from students. You can restore it to a draft later.`, destructive: true },
    ];
  }
  if (status === "published") {
    return [
      { to: "draft", label: "Unpublish", title: `Unpublish this ${n}?`,
        body: `${inside} disappear from the student area immediately, including for students who already have access. It becomes a draft you can publish again.`, destructive: true },
      { to: "archived", label: "Archive", title: `Archive this ${n}?`,
        body: `${inside} are hidden from every student. You can restore it to a draft later.`, destructive: true },
    ];
  }
  return [
    { to: "draft", label: "Restore to draft", title: `Restore this ${n} to a draft?`,
      body: `The ${n} stays hidden from students until you publish it again.`, destructive: false },
  ];
}

export function SectionStatusControls({
  kind,
  id,
  status,
  missing,
}: {
  kind: SectionKind;
  id: string;
  status: ContentStatus;
  missing: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, startTransition] = useTransition();
  const options = optionsFor(kind, status);

  function confirm() {
    if (!pending) return;
    const target = pending;
    startTransition(async () => {
      const result = await setSectionStatus(kind, id, target.to);
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