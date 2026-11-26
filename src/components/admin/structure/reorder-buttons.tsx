"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { moveSection, type SectionKind } from "@/app/admin/structure/actions";

const small = { width: "2.25rem", height: "2.25rem" } as const;

export function ReorderButtons({
  kind,
  id,
  title,
  isFirst,
  isLast,
}: {
  kind: SectionKind;
  id: string;
  title: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();

  function move(direction: "up" | "down") {
    startTransition(async () => {
      const result = await moveSection(kind, id, direction);
      if (!result.ok) toast.error(result.error);
      router.refresh();
    });
  }

  return (
    <div style={{ display: "flex", gap: "0.35rem" }}>
      <button
        type="button"
        className="admin-icon-btn"
        style={small}
        aria-label={`Move ${title} up`}
        disabled={busy || isFirst}
        onClick={() => move("up")}
      >
        <ChevronUp size={18} aria-hidden />
      </button>
      <button
        type="button"
        className="admin-icon-btn"
        style={small}
        aria-label={`Move ${title} down`}
        disabled={busy || isLast}
        onClick={() => move("down")}
      >
        <ChevronDown size={18} aria-hidden />
      </button>
    </div>
  );
}