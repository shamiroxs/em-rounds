"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  createCourse,
  updateCourse,
  type CourseFormState,
} from "@/app/admin/courses/actions";
import { slugify } from "@/lib/admin/validation";

type Initial = { title: string; slug: string; description: string; sortOrder: string };

const EMPTY: Initial = { title: "", slug: "", description: "", sortOrder: "0" };

export function CourseForm({
  mode,
  courseId,
  initial = EMPTY,
  slugLocked = false,
}: {
  mode: "create" | "edit";
  courseId?: string;
  initial?: Initial;
  /** true once a course is published/archived: the web address cannot change. */
  slugLocked?: boolean;
}) {
  const action =
    mode === "create" ? createCourse : updateCourse.bind(null, courseId ?? "");
  const [state, formAction, pending] = useActionState<CourseFormState, FormData>(
    action,
    { ok: false },
  );

  const slugRef = useRef<HTMLInputElement>(null);
  const slugTouched = useRef(mode === "edit");

  useEffect(() => {
    if (state.ok && state.savedAt) toast.success("Course saved.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  const v = state.values ?? initial;
  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="admin-form-grid" noValidate>
      {state.error && (
        <div className="error-box" role="alert">{state.error}</div>
      )}

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
        {err.title && <p id="title-error" className="field-hint" role="alert" style={{ color: "var(--danger-text)" }}>{err.title}</p>}
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
        <p id="slug-hint" className="field-hint" style={err.slug ? { color: "var(--danger-text)" } : undefined} role={err.slug ? "alert" : undefined}>
          {err.slug ??
            (slugLocked
              ? "Locked: students may have links to this course. Unpublish it first to change the address."
              : "Appears in the course link, for example /learn/emergency-medicine.")}
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          className="field-input"
          defaultValue={v.description}
          maxLength={2000}
          rows={5}
          aria-invalid={err.description ? true : undefined}
          aria-describedby="description-hint"
        />
        <p id="description-hint" className="field-hint" style={err.description ? { color: "var(--danger-text)" } : undefined} role={err.description ? "alert" : undefined}>
          {err.description ?? "Shown to students on the course card. Required before the course can be published."}
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
          <p id="order-hint" className="field-hint" style={err.sortOrder ? { color: "var(--danger-text)" } : undefined} role={err.sortOrder ? "alert" : undefined}>
            {err.sortOrder ?? "Lower numbers appear first."}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create draft course" : "Save changes"}
        </button>
        <Link href="/admin/courses" className="secondary-button">
          {mode === "create" ? "Cancel" : "Back to courses"}
        </Link>
      </div>
    </form>
  );
}
