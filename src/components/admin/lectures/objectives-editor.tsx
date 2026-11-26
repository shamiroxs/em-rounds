"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  addObjective,
  deleteObjective,
  moveObjective,
  updateObjective,
  type ChildResult,
} from "@/app/admin/lectures/child-actions";

const small = { padding: "0.35rem 0.8rem", fontSize: "0.85rem" } as const;
const arrow = { width: "2.25rem", height: "2.25rem" } as const;

export function ObjectivesEditor({
  lectureId,
  objectives,
  canEdit,
}: {
  lectureId: string;
  objectives: { id: string; objective: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [newText, setNewText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function run(task: () => Promise<ChildResult>, success: string, after?: () => void) {
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        toast.success(success);
        after?.();
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {objectives.length === 0 ? (
        <p className="muted-copy" role="status">No learning objectives yet.</p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "grid", gap: "0.7rem" }}>
          {objectives.map((o, i) => (
            <li key={o.id}>
              {editingId === o.id ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <label className="field-label" htmlFor={`obj-${o.id}`}>Edit objective</label>
                  <textarea
                    id={`obj-${o.id}`}
                    className="field-input"
                    rows={2}
                    maxLength={300}
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                  />
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button type="button" className="primary-button" style={small} disabled={busy}
                      onClick={() => run(() => updateObjective(o.id, editText), "Objective saved.", () => setEditingId(null))}>
                      Save
                    </button>
                    <button type="button" className="secondary-button" style={small} disabled={busy} onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.6rem", justifyContent: "space-between", flexWrap: "wrap", alignItems: "flex-start" }}>
                  <span style={{ flex: "1 1 14rem" }}>{o.objective}</span>
                  {canEdit && (
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" className="admin-icon-btn" style={arrow} aria-label={`Move objective ${i + 1} up`}
                        disabled={busy || i === 0} onClick={() => run(() => moveObjective(o.id, "up"), "Moved.")}>
                        <ChevronUp size={18} aria-hidden />
                      </button>
                      <button type="button" className="admin-icon-btn" style={arrow} aria-label={`Move objective ${i + 1} down`}
                        disabled={busy || i === objectives.length - 1} onClick={() => run(() => moveObjective(o.id, "down"), "Moved.")}>
                        <ChevronDown size={18} aria-hidden />
                      </button>
                      <button type="button" className="secondary-button" style={small} disabled={busy}
                        onClick={() => { setEditingId(o.id); setEditText(o.objective); }}>
                        Edit
                      </button>
                      <button type="button" className="secondary-button" style={{ ...small, color: "var(--danger-text)", borderColor: "var(--danger-border)" }}
                        disabled={busy} onClick={() => setDeleteTarget(o.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {canEdit && (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label className="field-label" htmlFor="new-objective">Add a learning objective</label>
          <textarea
            id="new-objective"
            className="field-input"
            rows={2}
            maxLength={300}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            aria-describedby="objective-hint"
          />
          <p id="objective-hint" className="field-hint">
            Start with an action, for example “Identify the signs of tension pneumothorax.”
          </p>
          <div>
            <button type="button" className="secondary-button" disabled={busy || !newText.trim()}
              onClick={() => run(() => addObjective(lectureId, newText), "Objective added.", () => setNewText(""))}>
              {busy ? "Saving…" : "Add objective"}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this learning objective?"
        description="This removes the objective from the lecture. It cannot be undone."
        confirmLabel="Delete objective"
        destructive
        busy={busy}
        onConfirm={() => {
          const id = deleteTarget;
          if (!id) return;
          run(() => deleteObjective(id), "Objective deleted.", () => setDeleteTarget(null));
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}