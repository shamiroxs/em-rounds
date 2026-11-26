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
import { validateLectureInput } from "@/lib/admin/lecture-validation";
import { loadReadiness, type LectureRow } from "@/lib/admin/lecture-data";

// Every action: 1) server-side role check, 2) full input validation,
// 3) writes with the caller's own session (RLS is the second lock), 4) audit entry.

export type LectureFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
  values?: {
    title: string;
    slug: string;
    description: string;
    transcript: string;
    sortOrder: string;
    topicId: string;
  };
  savedAt?: number;
};

export type SimpleResult = { ok: true } | { ok: false; error: string };
export type DeleteResult = { ok: true; redirectTo: string } | { ok: false; error: string };

function formValues(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    title: get("title"),
    slug: get("slug"),
    description: get("description"),
    transcript: get("transcript"),
    sortOrder: get("sortOrder"),
    topicId: get("topicId"),
  };
}

function friendlyDbError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "That web address is already used by another lecture in this topic.";
  if (error.code === "42501") return "The database refused this change for your role.";
  if (error.code === "23503") return "The chosen topic does not exist.";
  console.error("Lecture action database error:", error.code, error.message);
  return "Something went wrong while saving. Please try again.";
}

async function checkTopic(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  topicId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("topics")
    .select("id, status")
    .eq("id", topicId)
    .maybeSingle();
  if (error) return "Could not check the topic. Please try again.";
  const topic = data as { id: string; status: string } | null;
  if (!topic) return "The chosen topic was not found.";
  if (topic.status === "archived") return "That topic is archived. Restore it or choose another topic.";
  return null;
}

export async function createLecture(
  _prev: LectureFormState,
  formData: FormData,
): Promise<LectureFormState> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { staff } = auth;

  const values = formValues(formData);
  const parsed = validateLectureInput(values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, values };

  const topicProblem = await checkTopic(staff.supabase, parsed.value.topic_id);
  if (topicProblem) return { ok: false, fieldErrors: { topicId: topicProblem }, values };

  // New lectures are ALWAYS drafts. Publishing is a separate, admin-only step.
  const { data, error } = await staff.supabase
    .from("lectures")
    .insert({ ...parsed.value, status: "draft" })
    .select("id")
    .single();
  if (error || !data) {
    const message = friendlyDbError(error ?? {});
    return error?.code === "23505"
      ? { ok: false, fieldErrors: { slug: message }, values }
      : { ok: false, error: message, values };
  }

  await writeAuditLog({
    actorUserId: staff.userId,
    action: "lecture.create",
    entityType: "lecture",
    entityId: data.id,
    details: { title: parsed.value.title, topic_id: parsed.value.topic_id },
  });

  revalidatePath("/admin/lectures");
  revalidatePath(`/admin/topics/${parsed.value.topic_id}`);
  redirect(`/admin/lectures/${data.id}?created=1`);
}

export async function updateLecture(
  lectureId: string,
  _prev: LectureFormState,
  formData: FormData,
): Promise<LectureFormState> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { staff } = auth;

  const values = formValues(formData);
  if (!UUID_RE.test(lectureId)) return { ok: false, error: "Invalid lecture.", values };

  const parsed = validateLectureInput(values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, values };

  const { data, error: readError } = await staff.supabase
    .from("lectures")
    .select("*")
    .eq("id", lectureId)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError), values };
  const existing = data as unknown as LectureRow | null;
  if (!existing) return { ok: false, error: "Lecture not found.", values };

  if (existing.status !== "draft" && !staff.can("content.publish")) {
    return {
      ok: false,
      error: "Only an administrator can edit a lecture that is published or archived.",
      values,
    };
  }
  if (existing.status !== "draft" && parsed.value.slug !== existing.slug) {
    return {
      ok: false,
      fieldErrors: { slug: "The web address can only be changed while the lecture is a draft." },
      values,
    };
  }
  if (parsed.value.topic_id !== existing.topic_id) {
    const topicProblem = await checkTopic(staff.supabase, parsed.value.topic_id);
    if (topicProblem) return { ok: false, fieldErrors: { topicId: topicProblem }, values };
  }

  const { data: updated, error } = await staff.supabase
    .from("lectures")
    .update(parsed.value)
    .eq("id", lectureId)
    .select("id")
    .maybeSingle();
  if (error) {
    const message = friendlyDbError(error);
    return error.code === "23505"
      ? { ok: false, fieldErrors: { slug: message }, values }
      : { ok: false, error: message, values };
  }
  if (!updated) return { ok: false, error: "You do not have permission to change this lecture.", values };

  const changed = (
    ["title", "slug", "description", "transcript", "sort_order", "topic_id"] as const
  ).filter((k) => (existing[k] ?? null) !== (parsed.value[k] ?? null));
  await writeAuditLog({
    actorUserId: staff.userId,
    action: "lecture.update",
    entityType: "lecture",
    entityId: lectureId,
    details: { changed_fields: changed, title: parsed.value.title },
  });

  revalidatePath("/admin/lectures");
  revalidatePath(`/admin/lectures/${lectureId}`);
  revalidatePath(`/admin/topics/${parsed.value.topic_id}`);
  revalidatePath("/learn");
  return { ok: true, values, savedAt: Date.now() };
}

export async function setLectureStatus(
  lectureId: string,
  nextStatus: string,
): Promise<SimpleResult> {
  const auth = await authorizeAction("content.publish");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!UUID_RE.test(lectureId)) return { ok: false, error: "Invalid lecture." };
  if (!isContentStatus(nextStatus)) return { ok: false, error: "Invalid status." };
  const next: ContentStatus = nextStatus;

  const { data, error: readError } = await staff.supabase
    .from("lectures")
    .select("*")
    .eq("id", lectureId)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError) };
  const lecture = data as unknown as LectureRow | null;
  if (!lecture) return { ok: false, error: "Lecture not found." };

  const current = lecture.status;
  if (!canTransition(current, next)) {
    return { ok: false, error: `A ${current} lecture cannot be changed to ${next}.` };
  }

  if (next === "published") {
    try {
      const readiness = await loadReadiness(staff.supabase, lecture);
      if (readiness.missing.length > 0) {
        return {
          ok: false,
          error: `This lecture cannot be published yet. It still needs ${readiness.missing.join(", ")}.`,
        };
      }
    } catch {
      return { ok: false, error: "Could not check whether the lecture is complete. Nothing was changed." };
    }
  }

  const { data: updated, error } = await staff.supabase
    .from("lectures")
    .update({ status: next })
    .eq("id", lectureId)
    .eq("status", current)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!updated) return { ok: false, error: "The lecture changed while you were working. Refresh and try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: `lecture.${statusActionName(current, next)}`,
    entityType: "lecture",
    entityId: lectureId,
    details: { title: lecture.title, from: current, to: next },
  });

  revalidatePath("/admin/lectures");
  revalidatePath(`/admin/lectures/${lectureId}`);
  revalidatePath(`/admin/topics/${lecture.topic_id}`);
  revalidatePath("/learn");
  return { ok: true };
}

/** Deletes a DRAFT lecture only. Its objectives and resources are removed with it. */
export async function deleteLecture(lectureId: string): Promise<DeleteResult> {
  const auth = await authorizeAction("content.delete");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!UUID_RE.test(lectureId)) return { ok: false, error: "Invalid lecture." };

  const { data, error: readError } = await staff.supabase
    .from("lectures")
    .select("*")
    .eq("id", lectureId)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError) };
  const lecture = data as unknown as LectureRow | null;
  if (!lecture) return { ok: false, error: "Lecture not found." };
  if (lecture.status !== "draft") {
    return { ok: false, error: "Only a draft lecture can be deleted. Archive it instead." };
  }

  const { data: deleted, error } = await staff.supabase
    .from("lectures")
    .delete()
    .eq("id", lectureId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!deleted) return { ok: false, error: "It could not be deleted. Refresh and try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: "lecture.delete",
    entityType: "lecture",
    entityId: lectureId,
    details: { title: lecture.title, slug: lecture.slug },
  });

  revalidatePath("/admin/lectures");
  revalidatePath(`/admin/topics/${lecture.topic_id}`);
  return { ok: true, redirectTo: `/admin/topics/${lecture.topic_id}` };
}