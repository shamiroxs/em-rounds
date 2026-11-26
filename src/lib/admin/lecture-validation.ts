// Pure validation rules for lectures, objectives and resources.
import {
  SLUG_MAX,
  SLUG_RE,
  SORT_MAX,
  SORT_MIN,
  TITLE_MAX,
  TITLE_MIN,
  cleanText,
  type FieldErrors,
  type Validated,
} from "@/lib/admin/validation";

export const LECTURE_DESCRIPTION_MAX = 5000;
export const TRANSCRIPT_MAX = 100000;
export const OBJECTIVE_MIN = 5;
export const OBJECTIVE_MAX = 300;
export const RESOURCE_TITLE_MIN = 2;
export const RESOURCE_TITLE_MAX = 150;
export const RESOURCE_DESCRIPTION_MAX = 500;
export const URL_MAX = 2000;

/** Set to false if lectures may be published without any learning objective. */
export const REQUIRE_OBJECTIVE_FOR_PUBLISH = true;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LectureInput = {
  title: string;
  slug: string;
  description: string | null;
  transcript: string | null;
  sort_order: number;
  topic_id: string;
};

export function validateLectureInput(raw: {
  title: unknown;
  slug: unknown;
  description: unknown;
  transcript: unknown;
  sortOrder: unknown;
  topicId: unknown;
}): Validated<LectureInput> {
  const fieldErrors: FieldErrors = {};

  const title = cleanText(raw.title);
  if (title.length < TITLE_MIN) fieldErrors.title = `Title must be at least ${TITLE_MIN} characters.`;
  else if (title.length > TITLE_MAX) fieldErrors.title = `Title must be at most ${TITLE_MAX} characters.`;

  const slug = cleanText(raw.slug).toLowerCase();
  if (!slug) fieldErrors.slug = "Web address is required.";
  else if (slug.length > SLUG_MAX) fieldErrors.slug = `Web address must be at most ${SLUG_MAX} characters.`;
  else if (!SLUG_RE.test(slug)) {
    fieldErrors.slug = "Use only lowercase letters, numbers and single hyphens.";
  }

  const description = cleanText(raw.description);
  if (description.length > LECTURE_DESCRIPTION_MAX) {
    fieldErrors.description = `Description must be at most ${LECTURE_DESCRIPTION_MAX} characters.`;
  }

  const transcript = cleanText(raw.transcript);
  if (transcript.length > TRANSCRIPT_MAX) {
    fieldErrors.transcript = `Transcript must be at most ${TRANSCRIPT_MAX} characters.`;
  }

  const sortText = cleanText(raw.sortOrder);
  const sortOrder = sortText === "" ? 0 : Number(sortText);
  if (!Number.isInteger(sortOrder) || sortOrder < SORT_MIN || sortOrder > SORT_MAX) {
    fieldErrors.sortOrder = `Order must be a whole number from ${SORT_MIN} to ${SORT_MAX}.`;
  }

  const topicId = cleanText(raw.topicId).toLowerCase();
  if (!UUID.test(topicId)) fieldErrors.topicId = "Choose a topic.";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: {
      title,
      slug,
      description: description || null,
      transcript: transcript || null,
      sort_order: sortOrder,
      topic_id: topicId,
    },
  };
}

export function validateObjective(
  raw: unknown,
): { ok: true; value: string } | { ok: false; error: string } {
  const text = cleanText(raw).replace(/\s+/g, " ");
  if (text.length < OBJECTIVE_MIN) return { ok: false, error: `Write at least ${OBJECTIVE_MIN} characters.` };
  if (text.length > OBJECTIVE_MAX) return { ok: false, error: `Keep it under ${OBJECTIVE_MAX} characters.` };
  return { ok: true, value: text };
}

export function normalizeExternalUrl(
  raw: unknown,
): { ok: true; url: string } | { ok: false; error: string } {
  const text = cleanText(raw);
  if (!text) return { ok: false, error: "Link is required." };
  if (text.length > URL_MAX) return { ok: false, error: `Link must be at most ${URL_MAX} characters.` };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, error: "Enter a full web link starting with https://" };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Only secure https:// links are allowed." };
  if (u.username || u.password) return { ok: false, error: "Links must not contain a username or password." };
  if (!u.hostname.includes(".")) return { ok: false, error: "Enter a link to a real website." };
  return { ok: true, url: u.toString() };
}

export function validateResourceInput(raw: {
  title: unknown;
  description: unknown;
  url: unknown;
}): Validated<{ title: string; description: string | null; external_url: string }> {
  const fieldErrors: FieldErrors = {};

  const title = cleanText(raw.title);
  if (title.length < RESOURCE_TITLE_MIN) fieldErrors.title = `Title must be at least ${RESOURCE_TITLE_MIN} characters.`;
  else if (title.length > RESOURCE_TITLE_MAX) fieldErrors.title = `Title must be at most ${RESOURCE_TITLE_MAX} characters.`;

  const description = cleanText(raw.description);
  if (description.length > RESOURCE_DESCRIPTION_MAX) {
    fieldErrors.description = `Description must be at most ${RESOURCE_DESCRIPTION_MAX} characters.`;
  }

  const url = normalizeExternalUrl(raw.url);
  if (!url.ok) fieldErrors.url = url.error;

  if (Object.keys(fieldErrors).length > 0 || !url.ok) return { ok: false, fieldErrors };
  return {
    ok: true,
    value: { title, description: description || null, external_url: url.url },
  };
}

/** Mux playback IDs are plain letters and numbers. */
export function isMuxPlaybackIdFormat(value: string) {
  return /^[A-Za-z0-9]{20,80}$/.test(value);
}

/** What is still missing before a lecture may be published. Empty = ready. */
export function lectureMissingForPublish(c: {
  title: string | null;
  slug: string | null;
  description: string | null;
  hasReadyVideo: boolean;
  objectiveCount: number;
}) {
  const missing: string[] = [];
  if (!c.title || c.title.trim().length < TITLE_MIN) missing.push("a title");
  if (!c.slug || !SLUG_RE.test(c.slug)) missing.push("a valid web address");
  if (!c.description || c.description.trim().length === 0) missing.push("a description");
  if (!c.hasReadyVideo) missing.push("a processed video");
  if (REQUIRE_OBJECTIVE_FOR_PUBLISH && c.objectiveCount < 1) missing.push("at least one learning objective");
  return missing;
}