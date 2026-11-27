"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createTag, saveQuestion } from "@/app/admin/questions/actions";
import {
  DIFFICULTIES,
  OPTIONS_MAX,
  OPTIONS_MIN,
  OPTION_LABELS,
} from "@/lib/admin/question-validation";
import type { TopicOption } from "@/lib/admin/lecture-data";
import type { TagOption } from "@/lib/admin/question-data";

export type QuestionInitial = {
  topicId: string;
  code: string;
  stem: string;
  difficulty: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  tagIds: string[];
};

const danger = { color: "var(--danger-text)" } as const;

export function QuestionEditor({
  questionId,
  initial,
  topics,
  tags,
  banner,
  backHref,
}: {
  questionId: string | null;
  initial: QuestionInitial;
  topics: TopicOption[];
  tags: TagOption[];
  /** Shown above the form, for example: saving will create version 2. */
  banner?: string;
  backHref: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [topicId, setTopicId] = useState(initial.topicId);
  const [code, setCode] = useState(initial.code);
  const [stem, setStem] = useState(initial.stem);
  const [difficulty, setDifficulty] = useState(initial.difficulty);
  const [options, setOptions] = useState<string[]>(initial.options);
  const [correctIndex, setCorrectIndex] = useState(initial.correctIndex);
  const [explanation, setExplanation] = useState(initial.explanation);
  const [tagIds, setTagIds] = useState<string[]>(initial.tagIds);
  const [tagList, setTagList] = useState<TagOption[]>(tags);
  const [newTag, setNewTag] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setOption(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function addOption() {
    if (options.length < OPTIONS_MAX) setOptions([...options, ""]);
  }
  function removeOption(i: number) {
    if (options.length <= OPTIONS_MIN) return;
    setOptions(options.filter((_, idx) => idx !== i));
    setCorrectIndex((c) => (c === i ? -1 : c > i ? c - 1 : c));
  }
  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  function addTag() {
    const label = newTag;
    startTransition(async () => {
      const result = await createTag(label);
      if (result.ok) {
        setTagList((prev) => (prev.some((t) => t.id === result.tag.id) ? prev : [...prev, result.tag]));
        setTagIds((prev) => (prev.includes(result.tag.id) ? prev : [...prev, result.tag.id]));
        setNewTag("");
      } else {
        toast.error(result.error);
      }
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const result = await saveQuestion(questionId, {
        topicId, code, stem, difficulty, options, correctIndex, explanation, tagIds,
      });
      if (result.ok) {
        if (questionId === null) {
          toast.success("Draft question created.");
          router.push(`/admin/questions/${result.questionId}?created=1`);
        } else {
          toast.success(
            result.createdNewVersion
              ? `Saved as a new draft (version ${result.versionNumber}).`
              : "Question saved.",
          );
          router.refresh();
        }
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="admin-form-grid" noValidate>
      {banner && <div className="error-box" role="note">{banner}</div>}

      <div className="admin-form-row">
        <div>
          <label className="field-label" htmlFor="topicId">Topic</label>
          <select id="topicId" className="field-input" value={topicId} onChange={(e) => setTopicId(e.target.value)}
            aria-invalid={errors.topicId ? true : undefined}>
            <option value="" disabled>Choose a topic…</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id} disabled={t.disabled && t.id !== initial.topicId}>
                {t.label}{t.disabled ? " (archived)" : ""}
              </option>
            ))}
          </select>
          {errors.topicId && <p className="field-hint" role="alert" style={danger}>{errors.topicId}</p>}
        </div>
        <div>
          <label className="field-label" htmlFor="difficulty">Difficulty</label>
          <select id="difficulty" className="field-input" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
            ))}
          </select>
          {errors.difficulty && <p className="field-hint" role="alert" style={danger}>{errors.difficulty}</p>}
        </div>
      </div>

      <div>
        <label className="field-label" htmlFor="code">Question code (optional)</label>
        <input id="code" className="field-input" style={{ maxWidth: "16rem" }} maxLength={40} value={code}
          onChange={(e) => setCode(e.target.value)} aria-invalid={errors.code ? true : undefined} />
        <p className="field-hint" style={errors.code ? danger : undefined} role={errors.code ? "alert" : undefined}>
          {errors.code ?? "A unique reference such as EM-0042. Leave blank if you do not use codes."}
        </p>
      </div>

      <div>
        <label className="field-label" htmlFor="stem">Question</label>
        <textarea id="stem" className="field-input" rows={6} maxLength={5000} value={stem}
          onChange={(e) => setStem(e.target.value)} aria-invalid={errors.stem ? true : undefined} />
        {errors.stem && <p className="field-hint" role="alert" style={danger}>{errors.stem}</p>}
      </div>

      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: "0.7rem" }}>
        <legend className="field-label">Answer options. Select the one correct answer.</legend>
        {options.map((text, i) => (
          <div key={i}>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <input
                type="radio"
                name="correct"
                checked={correctIndex === i}
                onChange={() => setCorrectIndex(i)}
                aria-label={`Mark option ${OPTION_LABELS[i]} as the correct answer`}
                style={{ width: "1.2rem", height: "1.2rem", flex: "none" }}
              />
              <span aria-hidden style={{ fontWeight: 700, width: "1.2rem" }}>{OPTION_LABELS[i]}</span>
              <input
                className="field-input"
                value={text}
                maxLength={500}
                onChange={(e) => setOption(i, e.target.value)}
                aria-label={`Option ${OPTION_LABELS[i]} text`}
                aria-invalid={errors[`option_${i}`] ? true : undefined}
              />
              <button type="button" className="admin-icon-btn" style={{ width: "2.5rem", height: "2.5rem", flex: "none" }}
                aria-label={`Remove option ${OPTION_LABELS[i]}`} disabled={options.length <= OPTIONS_MIN}
                onClick={() => removeOption(i)}>
                <X size={16} aria-hidden />
              </button>
            </div>
            {errors[`option_${i}`] && <p className="field-hint" role="alert" style={danger}>{errors[`option_${i}`]}</p>}
          </div>
        ))}
        {errors.options && <p className="field-hint" role="alert" style={danger}>{errors.options}</p>}
        {errors.correctIndex && <p className="field-hint" role="alert" style={danger}>{errors.correctIndex}</p>}
        <div>
          <button type="button" className="secondary-button" onClick={addOption} disabled={options.length >= OPTIONS_MAX}>
            <Plus size={16} aria-hidden style={{ marginRight: "0.35rem" }} /> Add option
          </button>
        </div>
      </fieldset>

      <div>
        <label className="field-label" htmlFor="explanation">Explanation</label>
        <textarea id="explanation" className="field-input" rows={5} maxLength={5000} value={explanation}
          onChange={(e) => setExplanation(e.target.value)} aria-describedby="explanation-hint"
          aria-invalid={errors.explanation ? true : undefined} />
        <p id="explanation-hint" className="field-hint" style={errors.explanation ? danger : undefined} role={errors.explanation ? "alert" : undefined}>
          {errors.explanation ?? "Why the correct answer is best. Required before publishing. Never shown until a student has answered."}
        </p>
      </div>

      <fieldset style={{ border: 0, margin: 0, padding: 0, display: "grid", gap: "0.6rem" }}>
        <legend className="field-label">Tags (optional)</legend>
        {tagList.length === 0 ? (
          <p className="field-hint">No tags yet. Create one below.</p>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1rem" }}>
            {tagList.map((t) => (
              <label key={t.id} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
                <input type="checkbox" checked={tagIds.includes(t.id)} onChange={() => toggleTag(t.id)} />
                {t.label}
              </label>
            ))}
          </div>
        )}
        {errors.tags && <p className="field-hint" role="alert" style={danger}>{errors.tags}</p>}
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <label className="field-label" htmlFor="newTag" style={{ position: "absolute", left: "-9999px" }}>New tag name</label>
          <input id="newTag" className="field-input" style={{ maxWidth: "16rem" }} maxLength={40} placeholder="New tag name"
            value={newTag} onChange={(e) => setNewTag(e.target.value)} />
          <button type="button" className="secondary-button" disabled={busy || !newTag.trim()} onClick={addTag}>
            Create tag
          </button>
        </div>
      </fieldset>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "Saving…" : questionId === null ? "Create draft question" : "Save changes"}
        </button>
        <Link href={backHref} className="secondary-button">{questionId === null ? "Cancel" : "Back"}</Link>
      </div>
    </form>
  );
}