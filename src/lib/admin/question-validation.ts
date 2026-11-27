// Pure validation rules for single-best-answer questions.
import { cleanText, type FieldErrors, type Validated } from "@/lib/admin/validation";

export const STEM_MIN = 10;
export const STEM_MAX = 5000;
export const OPTION_MAX = 500;
export const EXPLANATION_MAX = 5000;
export const OPTIONS_MIN = 2;
export const OPTIONS_MAX = 6;
export const TAGS_MAX = 10;
export const CODE_MAX = 40;
export const TAG_LABEL_MIN = 2;
export const TAG_LABEL_MAX = 40;

export const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"] as const;
export const DIFFICULTIES = ["unclassified", "easy", "moderate", "difficult"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QuestionInput = {
  topicId: string;
  code: string | null;
  stem: string;
  difficulty: Difficulty;
  options: string[];
  correctIndex: number;
  explanation: string;
  tagIds: string[];
};

export function validateQuestionInput(raw: unknown): Validated<QuestionInput> {
  const fieldErrors: FieldErrors = {};
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const topicId = cleanText(r.topicId).toLowerCase();
  if (!UUID.test(topicId)) fieldErrors.topicId = "Choose a topic.";

  const codeText = cleanText(r.code);
  const code = codeText === "" ? null : codeText;
  if (code && (code.length > CODE_MAX || !/^[A-Za-z0-9._-]+$/.test(code))) {
    fieldErrors.code = `Use up to ${CODE_MAX} letters, numbers, dots, hyphens or underscores.`;
  }

  const stem = cleanText(r.stem);
  if (stem.length < STEM_MIN) fieldErrors.stem = `The question must be at least ${STEM_MIN} characters.`;
  else if (stem.length > STEM_MAX) fieldErrors.stem = `The question must be at most ${STEM_MAX} characters.`;

  const difficulty =
    typeof r.difficulty === "string" && (DIFFICULTIES as readonly string[]).includes(r.difficulty)
      ? (r.difficulty as Difficulty)
      : null;
  if (!difficulty) fieldErrors.difficulty = "Choose a difficulty.";

  const rawOptions = Array.isArray(r.options) ? r.options : [];
  if (rawOptions.length < OPTIONS_MIN || rawOptions.length > OPTIONS_MAX) {
    fieldErrors.options = `Provide ${OPTIONS_MIN} to ${OPTIONS_MAX} answer options.`;
  }
  const options = rawOptions.slice(0, OPTIONS_MAX).map((o) => cleanText(o).replace(/\s+/g, " "));
  const seen = new Map<string, number>();
  options.forEach((text, i) => {
    if (!text) {
      fieldErrors[`option_${i}`] = "This option cannot be empty.";
    } else if (text.length > OPTION_MAX) {
      fieldErrors[`option_${i}`] = `Keep each option under ${OPTION_MAX} characters.`;
    } else {
      const key = text.toLowerCase();
      const first = seen.get(key);
      if (first !== undefined) {
        fieldErrors[`option_${i}`] = `Same as option ${OPTION_LABELS[first]}. Each option must be different.`;
      } else {
        seen.set(key, i);
      }
    }
  });

  const correctIndex =
    typeof r.correctIndex === "number" && Number.isInteger(r.correctIndex) ? r.correctIndex : -1;
  if (correctIndex < 0 || correctIndex >= options.length) {
    fieldErrors.correctIndex = "Select the one correct answer.";
  }

  const explanation = cleanText(r.explanation);
  if (explanation.length > EXPLANATION_MAX) {
    fieldErrors.explanation = `The explanation must be at most ${EXPLANATION_MAX} characters.`;
  }

  const tagIds = [
    ...new Set((Array.isArray(r.tagIds) ? r.tagIds : []).map((t) => cleanText(t).toLowerCase())),
  ];
  if (tagIds.length > TAGS_MAX || tagIds.some((t) => !UUID.test(t))) {
    fieldErrors.tags = `Choose up to ${TAGS_MAX} valid tags.`;
  }

  if (Object.keys(fieldErrors).length > 0 || !difficulty) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: { topicId, code, stem, difficulty, options, correctIndex, explanation, tagIds },
  };
}

/** What is still missing before a question may be published. Empty = ready. */
export function questionMissingForPublish(c: {
  stem: string;
  optionCount: number;
  hasCorrect: boolean;
  explanation: string;
}) {
  const missing: string[] = [];
  if (c.stem.trim().length < STEM_MIN) missing.push("the question text");
  if (c.optionCount < OPTIONS_MIN) missing.push("at least two answer options");
  if (!c.hasCorrect) missing.push("a correct answer");
  if (c.explanation.trim().length === 0) missing.push("an explanation");
  return missing;
}

export function validateTagLabel(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const label = cleanText(raw).replace(/\s+/g, " ");
  if (label.length < TAG_LABEL_MIN) return { ok: false, error: `Tag names need at least ${TAG_LABEL_MIN} characters.` };
  if (label.length > TAG_LABEL_MAX) return { ok: false, error: `Tag names can be at most ${TAG_LABEL_MAX} characters.` };
  return { ok: true, value: label };
}