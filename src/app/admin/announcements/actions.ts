"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { UUID_RE } from "@/lib/learning";
import {
  canTransition,
  isContentStatus,
  statusActionName,
  type ContentStatus,
  type FieldErrors,
} from "@/lib/admin/validation";
import { validateAnnouncementInput } from "@/lib/admin/announcement-validation";

// Announcements are administrator-only (database RLS enforces this as well).

export type AnnouncementFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
  values?: { title: string; body: string; publishAt: string };
  savedAt?: number;
};

export type SimpleResult = { ok: true } | { ok: false; error: string };
export type DeleteResult = { ok: true; redirectTo: string } | { ok: false; error: string };

type Row = {
  id: string;
  title: string;
  body: string;
  status: ContentStatus;
  publish_at: string | null;
};

function formValues(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return { title: get("title"), body: get("body"), publishAt: get("publishAt") };
}

function friendlyDbError(error: { code?: string; message?: string }) {
  if (error.code === "42501") return "The database refused this change for your role.";
  console.error("Announcement action database error:", error.code, error.message);
  return "Something went wrong while saving. Please try again.";
}

export async function createAnnouncement(
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const auth = await authorizeAction("announcements.manage");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { staff } = auth;

  const values = formValues(formData);
  const parsed = validateAnnouncementInput(values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, values };

  const { data, error } = await staff.supabase
    .from("announcements")
    .insert({ ...parsed.value, status: "draft", created_by: staff.userId })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: friendlyDbError(error ?? {}), values };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: "announcement.create",
    entityType: "announcement",
    entityId: data.id,
    details: { title: parsed.value.title },
  });

  revalidatePath("/admin/announcements");
  redirect(`/admin/announcements/${data.id}?created=1`);
}

export async function updateAnnouncement(
  id: string,
  _prev: AnnouncementFormState,
  formData: FormData,
): Promise<AnnouncementFormState> {
  const auth = await authorizeAction("announcements.manage");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { staff } = auth;

  const values = formValues(formData);
  if (!UUID_RE.test(id)) return { ok: false, error: "Invalid announcement.", values };
  const parsed = validateAnnouncementInput(values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, values };

  const { data: existingData, error: readError } = await staff.supabase
    .from("announcements")
    .select("id, title, body, status, publish_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError), values };
  const existing = existingData as unknown as Row | null;
  if (!existing) return { ok: false, error: "Announcement not found.", values };

  const { data: updated, error } = await staff.supabase
    .from("announcements")
    .update(parsed.value)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error), values };
  if (!updated) return { ok: false, error: "You do not have permission to change this announcement.", values };

  const changed = (["title", "body", "publish_at"] as const).filter(
    (k) => (existing[k] ?? null) !== (parsed.value[k] ?? null),
  );
  await writeAuditLog({
    actorUserId: staff.userId,
    action: "announcement.update",
    entityType: "announcement",
    entityId: id,
    details: { changed_fields: changed, title: parsed.value.title },
  });

  revalidatePath("/admin/announcements");
  revalidatePath(`/admin/announcements/${id}`);
  return { ok: true, values, savedAt: Date.now() };
}

export async function setAnnouncementStatus(id: string, nextStatus: string): Promise<SimpleResult> {
  const auth = await authorizeAction("announcements.manage");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!UUID_RE.test(id)) return { ok: false, error: "Invalid announcement." };
  if (!isContentStatus(nextStatus)) return { ok: false, error: "Invalid status." };
  const next: ContentStatus = nextStatus;

  const { data, error: readError } = await staff.supabase
    .from("announcements")
    .select("id, title, body, status, publish_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError) };
  const row = data as unknown as Row | null;
  if (!row) return { ok: false, error: "Announcement not found." };

  const current = row.status;
  if (!canTransition(current, next)) {
    return { ok: false, error: `A ${current} announcement cannot be changed to ${next}.` };
  }

  // Publishing records a publication time unless a future one was scheduled.
  const patch: Record<string, unknown> = { status: next };
  if (next === "published" && !row.publish_at) patch.publish_at = new Date().toISOString();

  const { data: updated, error } = await staff.supabase
    .from("announcements")
    .update(patch)
    .eq("id", id)
    .eq("status", current)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!updated) return { ok: false, error: "The announcement changed while you were working. Refresh and try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: `announcement.${statusActionName(current, next)}`,
    entityType: "announcement",
    entityId: id,
    details: { title: row.title, from: current, to: next },
  });

  revalidatePath("/admin/announcements");
  revalidatePath(`/admin/announcements/${id}`);
  return { ok: true };
}

/** Only drafts and archived announcements can be deleted. Unpublish a live one first. */
export async function deleteAnnouncement(id: string): Promise<DeleteResult> {
  const auth = await authorizeAction("announcements.manage");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!UUID_RE.test(id)) return { ok: false, error: "Invalid announcement." };

  const { data, error: readError } = await staff.supabase
    .from("announcements")
    .select("id, title, body, status, publish_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError) };
  const row = data as unknown as Row | null;
  if (!row) return { ok: false, error: "Announcement not found." };
  if (row.status === "published") {
    return { ok: false, error: "Unpublish this announcement before deleting it." };
  }

  const { data: deleted, error } = await staff.supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .neq("status", "published")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!deleted) return { ok: false, error: "It could not be deleted. Refresh and try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: "announcement.delete",
    entityType: "announcement",
    entityId: id,
    details: { title: row.title },
  });

  revalidatePath("/admin/announcements");
  return { ok: true, redirectTo: "/admin/announcements" };
}