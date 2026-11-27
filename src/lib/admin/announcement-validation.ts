import { cleanText, type FieldErrors, type Validated } from "@/lib/admin/validation";
import { istInputToIso } from "@/lib/admin/datetime";

export const ANN_TITLE_MIN = 3;
export const ANN_TITLE_MAX = 150;
export const ANN_BODY_MIN = 3;
export const ANN_BODY_MAX = 5000;

export type AnnouncementInput = { title: string; body: string; publish_at: string | null };

export function validateAnnouncementInput(raw: {
  title: unknown;
  body: unknown;
  publishAt: unknown;
}): Validated<AnnouncementInput> {
  const fieldErrors: FieldErrors = {};

  const title = cleanText(raw.title);
  if (title.length < ANN_TITLE_MIN) fieldErrors.title = `Title must be at least ${ANN_TITLE_MIN} characters.`;
  else if (title.length > ANN_TITLE_MAX) fieldErrors.title = `Title must be at most ${ANN_TITLE_MAX} characters.`;

  const body = cleanText(raw.body);
  if (body.length < ANN_BODY_MIN) fieldErrors.body = `The message must be at least ${ANN_BODY_MIN} characters.`;
  else if (body.length > ANN_BODY_MAX) fieldErrors.body = `The message must be at most ${ANN_BODY_MAX} characters.`;

  const publishText = cleanText(raw.publishAt);
  let publishAt: string | null = null;
  if (publishText !== "") {
    publishAt = istInputToIso(publishText);
    if (!publishAt) fieldErrors.publishAt = "Enter a valid date and time.";
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
  return { ok: true, value: { title, body, publish_at: publishAt } };
}