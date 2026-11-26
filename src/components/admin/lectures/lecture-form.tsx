"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  createLecture,
  updateLecture,
  type LectureFormState,
} from "@/app/admin/lectures/actions";
import { slugify } from "@/lib/admin/validation";
import type { TopicOption } from "@/lib/admin/lecture-data";

type Initial = {
  title: string;
  slug: string;
  description: string;
  transcript: string;
  sortOrder: string;
  topicId: string;
};

export function LectureForm({
  mode,
  lectureId,
  initial,
  topics,
  slugLocked = false,
  backHref,
}: {
  mode: "create" | "edit";
  lectureId?: string;
  initial: Initial;
  topics: TopicOption[];
  slugLocked?: boolean;
  backHref: string;
}) {
  const action =
    mode === "create" ? createLecture : updateLecture.bind(null, lectureId ?? "");
  const [state, formAction, pending] = useActionState<LectureFormState, FormData>(action, { ok: false });

  const slugRef = useRef<HTMLInputElement>(null);
  const slugTouched = useRef(mode === "edit");

  useEffect(() => {
    if (state.ok && state.savedAt) toast.success("Lecture saved.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  const v = state.values ?? initial;
  const err = state.fieldErrors ?? {};
  const danger = { color: "var(--danger-text)" };

  return (
    <form action={formAction} className="admin-form-grid" noValidate>
      {state.error && <div className="error-box" role="alert">{state.error}</div>}

      <div>
        <label className="field-label" htmlFor="topicId">Topic</label>
        <select
          id="topicId"
          name="topicId"
          className="field-input"
          defaultValue={v.topicId}
          required
          aria-invalid={err.topicId ? true : undefined}
          aria-describedby="topic-hint"
        >
          <option value="" disabled>Choose a topic…</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id} disabled={t.disabled && t.id !== v.topicId}>
              {t.label}{t.disabled ? " (archived)" : ""}
            </option>
          ))}
        </select>
        <p id="topic-hint" className="field-hint" style={err.topicId ? danger : undefined} role={err.topicId ? "alert" : undefined}>
          {err.topicId ?? "Where this lecture appears in the course."}
        </p>
      </div>

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
              ? "Locked while published. Unpublish first to change it."
              : "Lowercase letters, numbers and hyphens. Must be unique within the topic.")}
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          className="field-input"
          defaultValue={v.description}
          maxLength={5000}
          rows={5}
          aria-invalid={err.description ? true : undefined}
          aria-describedby="description-hint"
        />
        <p id="description-hint" className="field-hint" style={err.description ? danger : undefined} role={err.description ? "alert" : undefined}>
          {err.description ?? "Shown to students above the video. Required before publishing."}
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="transcript">Transcript (optional)</label>
        <textarea
          id="transcript"
          name="transcript"
          className="field-input"
          defaultValue={v.transcript}
          maxLength={100000}
          rows={6}
          aria-invalid={err.transcript ? true : undefined}
          aria-describedby="transcript-hint"
        />
        <p id="transcript-hint" className="field-hint" style={err.transcript ? danger : undefined} role={err.transcript ? "alert" : undefined}>
          {err.transcript ?? "Stored with the lecture. The student page does not display it yet."}
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
            {err.sortOrder ?? "Lower numbers appear first within the topic."}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <button type="submit" className="primary-button" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create draft lecture" : "Save changes"}
        </button>
        <Link href={backHref} className="secondary-button">
          {mode === "create" ? "Cancel" : "Back"}
        </Link>
      </div>
    </form>
  );
}