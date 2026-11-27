"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  createAnnouncement,
  updateAnnouncement,
  type AnnouncementFormState,
} from "@/app/admin/announcements/actions";

type Initial = { title: string; body: string; publishAt: string };

export function AnnouncementForm({
  mode,
  announcementId,
  initial = { title: "", body: "", publishAt: "" },
}: {
  mode: "create" | "edit";
  announcementId?: string;
  initial?: Initial;
}) {
  const action =
    mode === "create" ? createAnnouncement : updateAnnouncement.bind(null, announcementId ?? "");
  const [state, formAction, pending] = useActionState<AnnouncementFormState, FormData>(action, { ok: false });

  useEffect(() => {
    if (state.ok && state.savedAt) toast.success("Announcement saved.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  const v = state.values ?? initial;
  const err = state.fieldErrors ?? {};
  const danger = { color: "var(--danger-text)" };

  return (
    <form action={formAction} className="admin-form-grid" noValidate>
      {state.error && <div className="error-box" role="alert">{state.error}</div>}

      <div>
        <label className="field-label" htmlFor="title">Title</label>
        <input id="title" name="title" className="field-input" defaultValue={v.title} maxLength={150} required
          aria-invalid={err.title ? true : undefined} aria-describedby={err.title ? "title-error" : undefined} />
        {err.title && <p id="title-error" className="field-hint" role="alert" style={danger}>{err.title}</p>}
      </div>

      <div>
        <label className="field-label" htmlFor="body">Message</label>
        <textarea id="body" name="body" className="field-input" defaultValue={v.body} maxLength={5000} rows={8} required
          aria-invalid={err.body ? true : undefined} aria-describedby="body-hint" />
        <p id="body-hint" className="field-hint" style={err.body ? danger : undefined} role={err.body ? "alert" : undefined}>
          {err.body ?? "Plain text. Line breaks are kept."}
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="publishAt">Publish date and time (optional, IST)</label>
        <input id="publishAt" name="publishAt" type="datetime-local" className="field-input" style={{ maxWidth: "18rem" }}
          defaultValue={v.publishAt} aria-invalid={err.publishAt ? true : undefined} aria-describedby="publish-hint" />
        <p id="publish-hint" className="field-hint" style={err.publishAt ? danger : undefined} role={err.publishAt ? "alert" : undefined}>
          {err.publishAt ?? "If you pick a future time and publish, the announcement becomes visible at that time. Leave empty to publish immediately."}
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create draft announcement" : "Save changes"}
        </button>
        <Link href="/admin/announcements" className="secondary-button">{mode === "create" ? "Cancel" : "Back"}</Link>
      </div>
    </form>
  );
}