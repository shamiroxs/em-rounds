"use server";

import { revalidatePath } from "next/cache";
import { authorizeAction, type StaffContext } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { UUID_RE } from "@/lib/learning";
import { SORT_MAX, type FieldErrors } from "@/lib/admin/validation";
import { validateObjective, validateResourceInput } from "@/lib/admin/lecture-validation";

export type ChildResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export type ResourceInput = { title: string; description: string; url: string };

type Table = "lecture_objectives" | "lecture_resources";

// Editors may change a lecture's objectives/resources only while it is a draft.
// Administrators may always do so. (The database allows editors on any lecture,
// so this rule is enforced here, on the server.)
async function guardLecture(
  staff: StaffContext,
  lectureId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(lectureId)) return { ok: false, error: "Invalid lecture." };
  const { data, error } = await staff.supabase
    .from("lectures")
    .select("id, status")
    .eq("id", lectureId)
    .maybeSingle();
  if (error) return { ok: false, error: "Could not load the lecture. Please try again." };
  const lecture = data as { id: string; status: string } | null;
  if (!lecture) return { ok: false, error: "Lecture not found." };
  if (lecture.status !== "draft" && !staff.can("content.publish")) {
    return { ok: false, error: "Only an administrator can change a lecture that is published or archived." };
  }
  return { ok: true };
}

async function lectureIdOf(staff: StaffContext, table: Table, id: string) {
  if (!UUID_RE.test(id)) return null;
  const { data, error } = await staff.supabase
    .from(table)
    .select("id, lecture_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { lecture_id: string }).lecture_id;
}

async function nextSortOrder(staff: StaffContext, table: Table, lectureId: string) {
  const { data } = await staff.supabase
    .from(table)
    .select("sort_order")
    .eq("lecture_id", lectureId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { sort_order: number } | null)?.sort_order ?? 0) + 10;
}

function done(lectureId: string) {
  revalidatePath(`/admin/lectures/${lectureId}`);
  revalidatePath("/learn");
}

async function move(
  table: Table,
  id: string,
  direction: string,
  action: string,
): Promise<ChildResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  if (direction !== "up" && direction !== "down") return { ok: false, error: "Invalid direction." };

  const lectureId = await lectureIdOf(staff, table, id);
  if (!lectureId) return { ok: false, error: "Item not found." };
  const guard = await guardLecture(staff, lectureId);
  if (!guard.ok) return guard;

  const { data, error } = await staff.supabase
    .from(table)
    .select("id, sort_order")
    .eq("lecture_id", lectureId)
    .order("sort_order")
    .order("id");
  if (error) return { ok: false, error: "Could not load the list. Please try again." };
  const siblings = (data ?? []) as { id: string; sort_order: number }[];

  const index = siblings.findIndex((s) => s.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= siblings.length) return { ok: true };

  const reordered = [...siblings];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const step = reordered.length * 10 <= SORT_MAX ? 10 : 1;
  for (let i = 0; i < reordered.length; i++) {
    const newOrder = (i + 1) * step;
    if (reordered[i].sort_order === newOrder) continue;
    const { error: updateError } = await staff.supabase
      .from(table)
      .update({ sort_order: newOrder })
      .eq("id", reordered[i].id);
    if (updateError) return { ok: false, error: "Could not reorder. Refresh and try again." };
  }

  await writeAuditLog({
    actorUserId: staff.userId,
    action,
    entityType: "lecture",
    entityId: lectureId,
    details: { direction },
  });
  done(lectureId);
  return { ok: true };
}

// ---- Learning objectives ---------------------------------------------------

export async function addObjective(lectureId: string, text: string): Promise<ChildResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  const guard = await guardLecture(staff, lectureId);
  if (!guard.ok) return guard;

  const parsed = validateObjective(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const { error } = await staff.supabase.from("lecture_objectives").insert({
    lecture_id: lectureId,
    objective: parsed.value,
    sort_order: await nextSortOrder(staff, "lecture_objectives", lectureId),
  });
  if (error) {
    console.error("addObjective failed:", error.code, error.message);
    return { ok: false, error: "Could not save the objective. Please try again." };
  }
  await writeAuditLog({ actorUserId: staff.userId, action: "lecture.objective_add", entityType: "lecture", entityId: lectureId });
  done(lectureId);
  return { ok: true };
}

export async function updateObjective(objectiveId: string, text: string): Promise<ChildResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  const lectureId = await lectureIdOf(staff, "lecture_objectives", objectiveId);
  if (!lectureId) return { ok: false, error: "Objective not found." };
  const guard = await guardLecture(staff, lectureId);
  if (!guard.ok) return guard;

  const parsed = validateObjective(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const { data, error } = await staff.supabase
    .from("lecture_objectives")
    .update({ objective: parsed.value })
    .eq("id", objectiveId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not save the objective. Please try again." };

  await writeAuditLog({ actorUserId: staff.userId, action: "lecture.objective_update", entityType: "lecture", entityId: lectureId });
  done(lectureId);
  return { ok: true };
}

export async function deleteObjective(objectiveId: string): Promise<ChildResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  const lectureId = await lectureIdOf(staff, "lecture_objectives", objectiveId);
  if (!lectureId) return { ok: false, error: "Objective not found." };
  const guard = await guardLecture(staff, lectureId);
  if (!guard.ok) return guard;

  const { data, error } = await staff.supabase
    .from("lecture_objectives")
    .delete()
    .eq("id", objectiveId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not delete the objective. Please try again." };

  await writeAuditLog({ actorUserId: staff.userId, action: "lecture.objective_delete", entityType: "lecture", entityId: lectureId });
  done(lectureId);
  return { ok: true };
}

export async function moveObjective(objectiveId: string, direction: string) {
  return move("lecture_objectives", objectiveId, direction, "lecture.objective_reorder");
}

// ---- Resources (external https links) -------------------------------------

export async function addResource(lectureId: string, input: ResourceInput): Promise<ChildResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  const guard = await guardLecture(staff, lectureId);
  if (!guard.ok) return guard;

  const parsed = validateResourceInput(input);
  if (!parsed.ok) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.fieldErrors };

  const { error } = await staff.supabase.from("lecture_resources").insert({
    lecture_id: lectureId,
    ...parsed.value,
    sort_order: await nextSortOrder(staff, "lecture_resources", lectureId),
  });
  if (error) {
    console.error("addResource failed:", error.code, error.message);
    return { ok: false, error: "Could not save the resource. Please try again." };
  }
  await writeAuditLog({
    actorUserId: staff.userId,
    action: "lecture.resource_add",
    entityType: "lecture",
    entityId: lectureId,
    details: { title: parsed.value.title },
  });
  done(lectureId);
  return { ok: true };
}

export async function updateResource(resourceId: string, input: ResourceInput): Promise<ChildResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  const lectureId = await lectureIdOf(staff, "lecture_resources", resourceId);
  if (!lectureId) return { ok: false, error: "Resource not found." };
  const guard = await guardLecture(staff, lectureId);
  if (!guard.ok) return guard;

  const parsed = validateResourceInput(input);
  if (!parsed.ok) return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.fieldErrors };

  const { data, error } = await staff.supabase
    .from("lecture_resources")
    .update(parsed.value)
    .eq("id", resourceId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not save the resource. Please try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: "lecture.resource_update",
    entityType: "lecture",
    entityId: lectureId,
    details: { title: parsed.value.title },
  });
  done(lectureId);
  return { ok: true };
}

export async function deleteResource(resourceId: string): Promise<ChildResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;
  const lectureId = await lectureIdOf(staff, "lecture_resources", resourceId);
  if (!lectureId) return { ok: false, error: "Resource not found." };
  const guard = await guardLecture(staff, lectureId);
  if (!guard.ok) return guard;

  const { data, error } = await staff.supabase
    .from("lecture_resources")
    .delete()
    .eq("id", resourceId)
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not delete the resource. Please try again." };

  await writeAuditLog({ actorUserId: staff.userId, action: "lecture.resource_delete", entityType: "lecture", entityId: lectureId });
  done(lectureId);
  return { ok: true };
}

export async function moveResource(resourceId: string, direction: string) {
  return move("lecture_resources", resourceId, direction, "lecture.resource_reorder");
}