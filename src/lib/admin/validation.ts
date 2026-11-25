// Pure validation rules for administration forms. No framework imports, so
// these can be unit-tested directly. The server ALWAYS runs these; the browser
// form is only a convenience.

export type ContentStatus = "draft" | "published" | "archived";
export const CONTENT_STATUSES: readonly ContentStatus[] = ["draft", "published", "archived"];

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const TITLE_MIN = 3;
export const TITLE_MAX = 150;
export const SLUG_MAX = 80;
export const DESCRIPTION_MAX = 2000;
export const SORT_MIN = 0;
export const SORT_MAX = 9999;

export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

// Removes control characters (except newline/tab) and trims.
export function cleanText(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export type FieldErrors = Record<string, string>;

export type CourseInput = {
  title: string;
  slug: string;
  description: string | null;
  sort_order: number;
};

export type Validated<T> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: FieldErrors };

export function validateCourseInput(raw: {
  title: unknown;
  slug: unknown;
  description: unknown;
  sortOrder: unknown;
}): Validated<CourseInput> {
  const fieldErrors: FieldErrors = {};

  const title = cleanText(raw.title);
  if (title.length < TITLE_MIN) fieldErrors.title = `Title must be at least ${TITLE_MIN} characters.`;
  else if (title.length > TITLE_MAX) fieldErrors.title = `Title must be at most ${TITLE_MAX} characters.`;

  const slug = cleanText(raw.slug).toLowerCase();
  if (!slug) fieldErrors.slug = "Web address is required.";
  else if (slug.length > SLUG_MAX) fieldErrors.slug = `Web address must be at most ${SLUG_MAX} characters.`;
  else if (!SLUG_RE.test(slug)) {
    fieldErrors.slug = "Use only lowercase letters, numbers and single hyphens (for example: emergency-medicine).";
  }

  const description = cleanText(raw.description);
  if (description.length > DESCRIPTION_MAX) {
    fieldErrors.description = `Description must be at most ${DESCRIPTION_MAX} characters.`;
  }

  const sortText = cleanText(raw.sortOrder);
  const sortOrder = sortText === "" ? 0 : Number(sortText);
  if (!Number.isInteger(sortOrder) || sortOrder < SORT_MIN || sortOrder > SORT_MAX) {
    fieldErrors.sortOrder = `Order must be a whole number from ${SORT_MIN} to ${SORT_MAX}.`;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: { title, slug, description: description || null, sort_order: sortOrder },
  };
}

// ---- Status changes -------------------------------------------------------

const TRANSITIONS: Record<ContentStatus, readonly ContentStatus[]> = {
  draft: ["published", "archived"],
  published: ["draft", "archived"], // draft = "unpublish"
  archived: ["draft"], // restore
};

export function canTransition(from: ContentStatus, to: ContentStatus) {
  return TRANSITIONS[from].includes(to);
}

export function isContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && (CONTENT_STATUSES as readonly string[]).includes(value);
}

export function statusActionName(from: ContentStatus, to: ContentStatus) {
  if (to === "published") return "publish";
  if (to === "archived") return "archive";
  return from === "published" ? "unpublish" : "restore";
}

/** What is still missing before a course may be published. Empty = ready. */
export function courseMissingForPublish(c: {
  title: string | null;
  slug: string | null;
  description: string | null;
}) {
  const missing: string[] = [];
  if (!c.title || c.title.trim().length < TITLE_MIN) missing.push("a title");
  if (!c.slug || !SLUG_RE.test(c.slug)) missing.push("a valid web address");
  if (!c.description || c.description.trim().length === 0) missing.push("a description");
  return missing;
}
