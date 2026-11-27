"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { setUserRole } from "@/app/admin/users/actions";

const ROLES = [
  {
    code: "content_editor",
    label: "Content editor",
    grantText: "They will be able to create and edit DRAFT courses, lectures, questions and videos. They cannot publish, delete, see users or see the audit log.",
  },
  {
    code: "admin",
    label: "Administrator",
    grantText: "They will be able to publish and unpublish content, manage announcements and see users and the audit log. They cannot change roles. This is a powerful role: grant it only to people you trust.",
  },
] as const;

export function RoleControls({ userId, roles }: { userId: string; roles: string[] }) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [target, setTarget] = useState<{ code: string; label: string; grant: boolean; text: string } | null>(null);

  function confirm() {
    if (!target) return;
    const t = target;
    startTransition(async () => {
      const result = await setUserRole(userId, t.code, t.grant);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setTarget(null);
    });
  }

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      {ROLES.map((r) => {
        const has = roles.includes(r.code);
        return (
          <div key={r.code} style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.6rem", alignItems: "center" }}>
            <div style={{ flex: "1 1 16rem" }}>
              <strong>{r.label}</strong>{" "}
              <span className={has ? "admin-badge admin-badge--ok" : "admin-badge"}>{has ? "Granted" : "Not granted"}</span>
            </div>
            <button
              type="button"
              className={has ? "secondary-button" : "primary-button"}
              disabled={busy}
              onClick={() =>
                setTarget({
                  code: r.code,
                  label: r.label,
                  grant: !has,
                  text: has ? "They will lose these permissions immediately." : r.grantText,
                })
              }
            >
              {has ? "Remove role" : "Grant role"}
            </button>
          </div>
        );
      })}
      <ConfirmDialog
        open={target !== null}
        title={target ? `${target.grant ? "Grant" : "Remove"} the ${target.label} role?` : ""}
        description={target?.text ?? ""}
        confirmLabel={target?.grant ? "Grant role" : "Remove role"}
        destructive={target ? !target.grant || target.code === "admin" : false}
        busy={busy}
        onConfirm={confirm}
        onCancel={() => setTarget(null)}
      />
    </div>
  );
}