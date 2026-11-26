"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  createSection,
  updateSection,
  type SectionFormState,
  type SectionKind,
} from "@/app/admin/structure/actions";
import { slugify } from "@/lib/admin/validation";

type Initial = { title: string; slug: string; description: string; sortOrder: string };
const EMPTY: Initial = { title: "", slug: "", description: "", sortOrder: "0" };

export function SectionForm({
  kind,
  mode,
  parentId,
  id,
  initial = EMPTY,
  slugLocked = false,
  backHref,
}: {
  kind: SectionKind;
  mode: "create" | "edit";
  /** Create mode: the course (for a subject) or subject (for a topic). */
  parentId?: string;
  /** Edit mode: the subject or topic being edited. */
  id?: string;
  initial?: Initial;
  slugLocked?: boolean;
  backHref: string;
}) {
  const action =
    mode === "create"
      ? createSection.bind(null, kind, parentId ?? "")
      : updateSection.bind(null, kind, id ?? "");
  const [state, formAction, pending] = useActionState<SectionFormState, FormData>(
    action,
    { ok: false },
  );

  const slugRef = useRef<HTMLInputElement>(null);
  const slugTouched = useRef(mode === "edit");
  const Noun = kind === "subject" ? "Subject" : "Topic";

  useEffect(() => {
    if (state.ok && state.savedAt) toast.success(`${Noun} saved.`);
    else if (state.error) toast.error(state.error);
  }, [state, Noun]);

  const v = state.values ?? initial;
  const err = state.fieldErrors ?? {};
  const danger = { color: "var(--danger-text)" };

  return (
    <form action={formAction} className="admin-form-grid" noValidate>
      {state.error && <div className="error-box" role="alert">{state.error}</div>}

      <div>
        <label className="field-label" htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          className="field-input"
          defaultValue={v.title}
          maxLength={150}
          required
          aria-invalid={err.title ? true : undefined}
          aria-describedby={err.title ? "title-error" : undefined}
          onChange={(e) => {
            if (mode === "create" && !slugTouched.current && slugRef.current) {
              slugRef.current.value = slugify(e.target.value);
            }
          }}
        />
        {err.title && <p id="title-error" className="field-hint" role="alert" style={danger}>{err.title}</p>}
      </div>

      <div>
        <label className="field-label" htmlFor="slug">Web address</label>
        <input
          id="slug"
          name="slug"
          ref={slugRef}
          className="field-input"
          defaultValue={v.slug}
          maxLength={80}
          required
          readOnly={slugLocked}
          aria-invalid={err.slug ? true : undefined}
          aria-describedby="slug-hint"
          onChange={() => { slugTouched.current = true; }}
        />
        <p id="slug-hint" className="field-hint" style={err.slug ? danger : undefined} role={err.slug ? "alert" : undefined}>
          {err.slug ??
            (slugLocked
              ? "Locked: students may have links to this. Unpublish it first to change the address."
              : "Lowercase letters, numbers and hyphens. It must be unique within its parent.")}
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="description">Description (optional)</label>
        <textarea
          id="description"
          name="description"
          className="field-input"
          defaultValue={v.description}
          maxLength={2000}
          rows={4}
          aria-invalid={err.description ? true : undefined}
          aria-describedby="description-hint"
        />
        <p id="description-hint" className="field-hint" style={err.description ? danger : undefined} role={err.description ? "alert" : undefined}>
          {err.description ?? "A short summary shown to students."}
        </p>
      </div>

      <div className="admin-form-row">
        <div>
          <label className="field-label" htmlFor="sortOrder">Display order</label>
          <input
            id="sortOrder"
            name="sortOrder"
            type="number"
            inputMode="numeric"
            min={0}
            max={9999}
            step={1}
            className="field-input"
            defaultValue={v.sortOrder}
            aria-invalid={err.sortOrder ? true : undefined}
            aria-describedby="order-hint"
          />
          <p id="order-hint" className="field-hint" style={err.sortOrder ? danger : undefined} role={err.sortOrder ? "alert" : undefined}>
            {err.sortOrder ?? "Lower numbers appear first."}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? `Create draft ${kind}` : "Save changes"}
        </button>
        <Link href={backHref} className="secondary-button">
          {mode === "create" ? "Cancel" : "Back"}
        </Link>
      </div>
    </form>
  );
}