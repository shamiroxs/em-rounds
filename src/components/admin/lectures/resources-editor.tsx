"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  addResource,
  deleteResource,
  moveResource,
  updateResource,
  type ChildResult,
  type ResourceInput,
} from "@/app/admin/lectures/child-actions";

const small = { padding: "0.35rem 0.8rem", fontSize: "0.85rem" } as const;
const arrow = { width: "2.25rem", height: "2.25rem" } as const;
const danger = { color: "var(--danger-text)" } as const;
const EMPTY: ResourceInput = { title: "", description: "", url: "" };

type ResourceView = { id: string; title: string; description: string | null; external_url: string | null };

function ResourceFields({
  value,
  onChange,
  errors,
  idPrefix,
}: {
  value: ResourceInput;
  onChange: (v: ResourceInput) => void;
  errors: Record<string, string>;
  idPrefix: string;
}) {
  return (
    <div style={{ display: "grid", gap: "0.7rem" }}>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-title`}>Title</label>
        <input id={`${idPrefix}-title`} className="field-input" maxLength={150} value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          aria-invalid={errors.title ? true : undefined} />
        {errors.title && <p className="field-hint" role="alert" style={danger}>{errors.title}</p>}
      </div>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-url`}>Link (https://…)</label>
        <input id={`${idPrefix}-url`} className="field-input" inputMode="url" maxLength={2000} value={value.url}
          onChange={(e) => onChange({ ...value, url: e.target.value })}
          aria-invalid={errors.url ? true : undefined} />
        {errors.url && <p className="field-hint" role="alert" style={danger}>{errors.url}</p>}
      </div>
      <div>
        <label className="field-label" htmlFor={`${idPrefix}-desc`}>Description (optional)</label>
        <input id={`${idPrefix}-desc`} className="field-input" maxLength={500} value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          aria-invalid={errors.description ? true : undefined} />
        {errors.description && <p className="field-hint" role="alert" style={danger}>{errors.description}</p>}
      </div>
    </div>
  );
}

export function ResourcesEditor({
  lectureId,
  resources,
  canEdit,
}: {
  lectureId: string;
  resources: ResourceView[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [form, setForm] = useState<ResourceInput>(EMPTY);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ResourceInput>(EMPTY);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function run(
    task: () => Promise<ChildResult>,
    success: string,
    onOk?: () => void,
    onFieldErrors?: (e: Record<string, string>) => void,
  ) {
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        toast.success(success);
        onOk?.();
        router.refresh();
      } else {
        onFieldErrors?.(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {resources.length === 0 ? (
        <p className="muted-copy" role="status">No resources yet.</p>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.8rem" }}>
          {resources.map((r, i) => (
            <li key={r.id} className="surface-card" style={{ margin: 0 }}>
              {editingId === r.id ? (
                <div style={{ display: "grid", gap: "0.7rem" }}>
                  <ResourceFields value={editForm} onChange={setEditForm} errors={editErrors} idPrefix={`edit-${r.id}`} />
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button type="button" className="primary-button" style={small} disabled={busy}
                      onClick={() => run(() => updateResource(r.id, editForm), "Resource saved.", () => { setEditingId(null); setEditErrors({}); }, setEditErrors)}>
                      Save
                    </button>
                    <button type="button" className="secondary-button" style={small} disabled={busy}
                      onClick={() => { setEditingId(null); setEditErrors({}); }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "0.6rem", justifyContent: "space-between", flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ flex: "1 1 14rem", minWidth: 0 }}>
                    <strong>{r.title}</strong>
                    {r.description && <div className="muted-copy" style={{ fontSize: "0.9rem" }}>{r.description}</div>}
                    {r.external_url ? (
                      <div className="admin-stat-sub" style={{ overflowWrap: "anywhere" }}>
                        <a href={r.external_url} target="_blank" rel="noopener noreferrer" className="text-link">{r.external_url}</a>
                      </div>
                    ) : (
                      <div className="admin-stat-sub">No link. Students cannot open this resource.</div>
                    )}
                  </div>
                  {canEdit && (
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", alignItems: "center" }}>
                      <button type="button" className="admin-icon-btn" style={arrow} aria-label={`Move ${r.title} up`}
                        disabled={busy || i === 0} onClick={() => run(() => moveResource(r.id, "up"), "Moved.")}>
                        <ChevronUp size={18} aria-hidden />
                      </button>
                      <button type="button" className="admin-icon-btn" style={arrow} aria-label={`Move ${r.title} down`}
                        disabled={busy || i === resources.length - 1} onClick={() => run(() => moveResource(r.id, "down"), "Moved.")}>
                        <ChevronDown size={18} aria-hidden />
                      </button>
                      <button type="button" className="secondary-button" style={small} disabled={busy}
                        onClick={() => { setEditingId(r.id); setEditErrors({}); setEditForm({ title: r.title, description: r.description ?? "", url: r.external_url ?? "" }); }}>
                        Edit
                      </button>
                      <button type="button" className="secondary-button" style={{ ...small, color: "var(--danger-text)", borderColor: "var(--danger-border)" }}
                        disabled={busy} onClick={() => setDeleteTarget(r.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <details>
          <summary className="field-label" style={{ cursor: "pointer" }}>Add a resource</summary>
          <div style={{ display: "grid", gap: "0.8rem", marginTop: "0.7rem" }}>
            <ResourceFields value={form} onChange={setForm} errors={formErrors} idPrefix="new" />
            <p className="field-hint">
              Resources are links to external web pages. Secure file downloads are not part of this version.
            </p>
            <div>
              <button type="button" className="secondary-button" disabled={busy}
                onClick={() => run(() => addResource(lectureId, form), "Resource added.", () => { setForm(EMPTY); setFormErrors({}); }, setFormErrors)}>
                {busy ? "Saving…" : "Add resource"}
              </button>
            </div>
          </div>
        </details>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this resource?"
        description="This removes the resource from the lecture. It cannot be undone."
        confirmLabel="Delete resource"
        destructive
        busy={busy}
        onConfirm={() => {
          const id = deleteTarget;
          if (!id) return;
          run(() => deleteResource(id), "Resource deleted.", () => setDeleteTarget(null));
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}