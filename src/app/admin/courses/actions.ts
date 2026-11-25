"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { UUID_RE } from "@/lib/learning";
import {
  canTransition,
  courseMissingForPublish,
  isContentStatus,
  statusActionName,
  validateCourseInput,
  type ContentStatus,
  type FieldErrors,
} from "@/lib/admin/validation";

// ---------------------------------------------------------------------------
// Every action below:
//   1. checks the caller's role on the SERVER first (authorizeAction),
//   2. validates ALL input again (never trusts the browser),
//   3. writes with the caller's OWN session, so the database RLS rules apply
//      as a second layer of protection,
//   4. records an audit entry after the change succeeds.
// ---------------------------------------------------------------------------

export type CourseFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
  /** Echoed back so the form keeps what the person typed after an error. */
  values?: { title: string; slug: string; description: string; sortOrder: string };
  savedAt?: number;
};

export type SimpleResult = { ok: true } | { ok: false; error: string };

function formValues(formData: FormData) {
  const get = (k: string) => (typeof formData.get(k) === "string" ? (formData.get(k) as string) : "");
  return {
    title: get("title"),
    slug: get("slug"),
    description: get("description"),
    sortOrder: get("sortOrder"),
  };
}

function friendlyDbError(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "That web address is already used by another course.";
  if (error.code === "42501") return "The database refused this change for your role.";
  if (error.code === "23503") return "This record is still in use, so it cannot be changed this way.";
  console.error("Course action database error:", error.code, error.message);
  return "Something went wrong while saving. Please try again.";
}

export async function createCourse(
  _prev: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { staff } = auth;

  const values = formValues(formData);
  const parsed = validateCourseInput(values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, values };

  // New courses are ALWAYS drafts. Publishing is a separate, admin-only step.
  const { data, error } = await staff.supabase
    .from("courses")
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
    action: "course.create",
    entityType: "course",
    entityId: data.id,
    details: { title: parsed.value.title, slug: parsed.value.slug },
  });

  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${data.id}?created=1`);
}

export async function updateCourse(
  courseId: string,
  _prev: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { staff } = auth;

  const values = formValues(formData);
  if (!UUID_RE.test(courseId)) return { ok: false, error: "Invalid course.", values };

  const parsed = validateCourseInput(values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, values };

  const { data: existing, error: readError } = await staff.supabase
    .from("courses")
    .select("id, status, slug, title, description, sort_order")
    .eq("id", courseId)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError), values };
  if (!existing) return { ok: false, error: "Course not found.", values };

  // Editors may change drafts only (this is also enforced by the database).
  if (existing.status !== "draft" && !staff.can("content.publish")) {
    return {
      ok: false,
      error: "Only an administrator can edit a course that is published or archived.",
      values,
    };
  }
  // The web address is part of student links, so it is locked outside drafts.
  if (existing.status !== "draft" && parsed.value.slug !== existing.slug) {
    return {
      ok: false,
      fieldErrors: { slug: "The web address can only be changed while the course is a draft." },
      values,
    };
  }

  const { data: updated, error } = await staff.supabase
    .from("courses")
    .update(parsed.value)
    .eq("id", courseId)
    .select("id")
    .maybeSingle();

  if (error) {
    const message = friendlyDbError(error);
    return error.code === "23505"
      ? { ok: false, fieldErrors: { slug: message }, values }
      : { ok: false, error: message, values };
  }
  // RLS hides rows the caller may not change, so "no row" means not permitted.
  if (!updated) return { ok: false, error: "You do not have permission to change this course.", values };

  const changed = (["title", "slug", "description", "sort_order"] as const).filter(
    (k) => (existing[k] ?? null) !== (parsed.value[k] ?? null),
  );
  await writeAuditLog({
    actorUserId: staff.userId,
    action: "course.update",
    entityType: "course",
    entityId: courseId,
    details: { changed_fields: changed, title: parsed.value.title },
  });

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  return { ok: true, values, savedAt: Date.now() };
}

export async function setCourseStatus(
  courseId: string,
  nextStatus: string,
): Promise<SimpleResult> {
  // Publishing, unpublishing and archiving are administrator-only.
  const auth = await authorizeAction("content.publish");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!UUID_RE.test(courseId)) return { ok: false, error: "Invalid course." };
  if (!isContentStatus(nextStatus)) return { ok: false, error: "Invalid status." };
  const next: ContentStatus = nextStatus;

  const { data: course, error: readError } = await staff.supabase
    .from("courses")
    .select("id, status, title, slug, description")
    .eq("id", courseId)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError) };
  if (!course) return { ok: false, error: "Course not found." };

  const current = course.status as ContentStatus;
  if (!canTransition(current, next)) {
    return { ok: false, error: `A ${current} course cannot be changed to ${next}.` };
  }
  if (next === "published") {
    const missing = courseMissingForPublish(course);
    if (missing.length > 0) {
      return { ok: false, error: `This course cannot be published yet. It still needs ${missing.join(" and ")}.` };
    }
  }

  const { data: updated, error } = await staff.supabase
    .from("courses")
    .update({ status: next })
    .eq("id", courseId)
    .eq("status", current) // guards against two admins acting at the same time
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!updated) return { ok: false, error: "The course changed while you were working. Refresh and try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: `course.${statusActionName(current, next)}`,
    entityType: "course",
    entityId: courseId,
    details: { title: course.title, from: current, to: next },
  });

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${courseId}`);
  revalidatePath("/learn");
  return { ok: true };
}

/**
 * Deletes a course only when it is an empty draft: no subjects and never
 * linked to an access product or a purchase. Anything else must be archived.
 */
export async function deleteCourse(courseId: string): Promise<SimpleResult> {
  const auth = await authorizeAction("content.delete");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!UUID_RE.test(courseId)) return { ok: false, error: "Invalid course." };

  const { data: course, error: readError } = await staff.supabase
    .from("courses")
    .select("id, status, title, slug")
    .eq("id", courseId)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError) };
  if (!course) return { ok: false, error: "Course not found." };
  if (course.status !== "draft") {
    return { ok: false, error: "Only a draft course can be deleted. Archive published courses instead." };
  }

  const [subjects, rules, entitlements] = await Promise.all([
    staff.supabase.from("subjects").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    staff.supabase.from("product_access_rules").select("id", { count: "exact", head: true }).eq("course_id", courseId),
    staff.supabase.from("entitlements").select("id", { count: "exact", head: true }).eq("course_id", courseId),
  ]);
  if (subjects.error || rules.error || entitlements.error) {
    return { ok: false, error: "Could not check whether this course is in use. Nothing was deleted." };
  }
  const blockers: string[] = [];
  if ((subjects.count ?? 0) > 0) blockers.push(`${subjects.count} subject(s)`);
  if ((rules.count ?? 0) > 0) blockers.push("an access product");
  if ((entitlements.count ?? 0) > 0) blockers.push("student access records");
  if (blockers.length > 0) {
    return { ok: false, error: `This course cannot be deleted because it has ${blockers.join(", ")}. Archive it instead.` };
  }

  const { data: deleted, error } = await staff.supabase
    .from("courses")
    .delete()
    .eq("id", courseId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!deleted) return { ok: false, error: "The course could not be deleted. Refresh and try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: "course.delete",
    entityType: "course",
    entityId: courseId,
    details: { title: course.title, slug: course.slug },
  });

  revalidatePath("/admin/courses");
  return { ok: true };
}
