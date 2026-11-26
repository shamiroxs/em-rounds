"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { UUID_RE } from "@/lib/learning";
import {
  SORT_MAX,
  canTransition,
  isContentStatus,
  sectionMissingForPublish,
  statusActionName,
  validateCourseInput,
  type ContentStatus,
  type FieldErrors,
} from "@/lib/admin/validation";

// ---------------------------------------------------------------------------
// Subjects and topics share the same rules, so one set of actions serves both.
// Every action: 1) checks the role on the server, 2) validates all input again,
// 3) writes with the caller's own session (database RLS is the second lock),
// 4) records an audit entry.
// ---------------------------------------------------------------------------

export type SectionKind = "subject" | "topic";

export type SectionFormState = {
  ok: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
  values?: { title: string; slug: string; description: string; sortOrder: string };
  savedAt?: number;
};

export type SimpleResult = { ok: true } | { ok: false; error: string };
export type DeleteResult =
  | { ok: true; redirectTo: string }
  | { ok: false; error: string };

type Row = {
  id: string;
  status: ContentStatus;
  title: string;
  slug: string;
  description: string | null;
  sort_order: number;
} & Record<string, unknown>;

const CFG = {
  subject: {
    table: "subjects",
    parentTable: "courses",
    parentCol: "course_id",
    noun: "subject",
    parentNoun: "course",
    path: (id: string) => `/admin/subjects/${id}`,
    parentPath: (id: string) => `/admin/courses/${id}`,
  },
  topic: {
    table: "topics",
    parentTable: "subjects",
    parentCol: "subject_id",
    noun: "topic",
    parentNoun: "subject",
    path: (id: string) => `/admin/topics/${id}`,
    parentPath: (id: string) => `/admin/subjects/${id}`,
  },
} as const;

function isKind(value: string): value is SectionKind {
  return value === "subject" || value === "topic";
}

function formValues(formData: FormData) {
  const get = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" ? v : "";
  };
  return {
    title: get("title"),
    slug: get("slug"),
    description: get("description"),
    sortOrder: get("sortOrder"),
  };
}

function friendlyDbError(
  error: { code?: string; message?: string },
  parentNoun: string,
) {
  if (error.code === "23505") return `That web address is already used in this ${parentNoun}.`;
  if (error.code === "42501") return "The database refused this change for your role.";
  if (error.code === "23503") return "This record is still in use, so it cannot be changed this way.";
  console.error("Structure action database error:", error.code, error.message);
  return "Something went wrong while saving. Please try again.";
}

export async function createSection(
  kind: string,
  parentId: string,
  _prev: SectionFormState,
  formData: FormData,
): Promise<SectionFormState> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { staff } = auth;

  const values = formValues(formData);
  if (!isKind(kind) || !UUID_RE.test(parentId)) {
    return { ok: false, error: "Invalid request.", values };
  }
  const cfg = CFG[kind];

  const parsed = validateCourseInput(values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, values };

  const { data: parentData, error: parentError } = await staff.supabase
    .from(cfg.parentTable)
    .select("id, status")
    .eq("id", parentId)
    .maybeSingle();
  if (parentError) return { ok: false, error: friendlyDbError(parentError, cfg.parentNoun), values };
  const parent = parentData as { id: string; status: string } | null;
  if (!parent) return { ok: false, error: `The ${cfg.parentNoun} was not found.`, values };
  if (parent.status === "archived") {
    return {
      ok: false,
      error: `This ${cfg.parentNoun} is archived. Restore it before adding a ${cfg.noun}.`,
      values,
    };
  }

  // New items are ALWAYS drafts. Publishing is a separate, admin-only step.
  const { data, error } = await staff.supabase
    .from(cfg.table)
    .insert({ [cfg.parentCol]: parentId, ...parsed.value, status: "draft" })
    .select("id")
    .single();

  if (error || !data) {
    const message = friendlyDbError(error ?? {}, cfg.parentNoun);
    return error?.code === "23505"
      ? { ok: false, fieldErrors: { slug: message }, values }
      : { ok: false, error: message, values };
  }

  await writeAuditLog({
    actorUserId: staff.userId,
    action: `${kind}.create`,
    entityType: kind,
    entityId: data.id,
    details: {
      title: parsed.value.title,
      slug: parsed.value.slug,
      [`${cfg.parentNoun}_id`]: parentId,
    },
  });

  revalidatePath(cfg.parentPath(parentId));
  redirect(`${cfg.path(data.id)}?created=1`);
}

export async function updateSection(
  kind: string,
  id: string,
  _prev: SectionFormState,
  formData: FormData,
): Promise<SectionFormState> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return { ok: false, error: auth.error };
  const { staff } = auth;

  const values = formValues(formData);
  if (!isKind(kind) || !UUID_RE.test(id)) {
    return { ok: false, error: "Invalid request.", values };
  }
  const cfg = CFG[kind];

  const parsed = validateCourseInput(values);
  if (!parsed.ok) return { ok: false, fieldErrors: parsed.fieldErrors, values };

  const { data, error: readError } = await staff.supabase
    .from(cfg.table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError, cfg.parentNoun), values };
  const existing = data as unknown as Row | null;
  if (!existing) return { ok: false, error: `This ${cfg.noun} was not found.`, values };

  // Editors may change drafts only (the database enforces this as well).
  if (existing.status !== "draft" && !staff.can("content.publish")) {
    return {
      ok: false,
      error: `Only an administrator can edit a ${cfg.noun} that is published or archived.`,
      values,
    };
  }
  // The web address is part of student links, so it is locked outside drafts.
  if (existing.status !== "draft" && parsed.value.slug !== existing.slug) {
    return {
      ok: false,
      fieldErrors: { slug: "The web address can only be changed while this is a draft." },
      values,
    };
  }

  const { data: updated, error } = await staff.supabase
    .from(cfg.table)
    .update(parsed.value)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    const message = friendlyDbError(error, cfg.parentNoun);
    return error.code === "23505"
      ? { ok: false, fieldErrors: { slug: message }, values }
      : { ok: false, error: message, values };
  }
  // RLS hides rows the caller may not change, so "no row" means not permitted.
  if (!updated) {
    return { ok: false, error: `You do not have permission to change this ${cfg.noun}.`, values };
  }

  const changed = (["title", "slug", "description", "sort_order"] as const).filter(
    (k) => (existing[k] ?? null) !== (parsed.value[k] ?? null),
  );
  await writeAuditLog({
    actorUserId: staff.userId,
    action: `${kind}.update`,
    entityType: kind,
    entityId: id,
    details: { changed_fields: changed, title: parsed.value.title },
  });

  revalidatePath(cfg.path(id));
  revalidatePath(cfg.parentPath(String(existing[cfg.parentCol])));
  return { ok: true, values, savedAt: Date.now() };
}

export async function setSectionStatus(
  kind: string,
  id: string,
  nextStatus: string,
): Promise<SimpleResult> {
  // Publishing, unpublishing and archiving are administrator-only.
  const auth = await authorizeAction("content.publish");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!isKind(kind) || !UUID_RE.test(id)) return { ok: false, error: "Invalid request." };
  if (!isContentStatus(nextStatus)) return { ok: false, error: "Invalid status." };
  const cfg = CFG[kind];
  const next: ContentStatus = nextStatus;

  const { data, error: readError } = await staff.supabase
    .from(cfg.table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError, cfg.parentNoun) };
  const row = data as unknown as Row | null;
  if (!row) return { ok: false, error: `This ${cfg.noun} was not found.` };

  const current = row.status;
  if (!canTransition(current, next)) {
    return { ok: false, error: `A ${current} ${cfg.noun} cannot be changed to ${next}.` };
  }
  if (next === "published") {
    const missing = sectionMissingForPublish(row);
    if (missing.length > 0) {
      return { ok: false, error: `This ${cfg.noun} cannot be published yet. It still needs ${missing.join(" and ")}.` };
    }
  }

  const { data: updated, error } = await staff.supabase
    .from(cfg.table)
    .update({ status: next })
    .eq("id", id)
    .eq("status", current) // guards against two admins acting at the same time
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error, cfg.parentNoun) };
  if (!updated) return { ok: false, error: "This item changed while you were working. Refresh and try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: `${kind}.${statusActionName(current, next)}`,
    entityType: kind,
    entityId: id,
    details: { title: row.title, from: current, to: next },
  });

  revalidatePath(cfg.path(id));
  revalidatePath(cfg.parentPath(String(row[cfg.parentCol])));
  revalidatePath("/learn");
  return { ok: true };
}

/**
 * Deletes an EMPTY DRAFT only. A subject must have no topics. A topic must have
 * no sub-topics, lectures or questions. Anything else must be archived.
 */
export async function deleteSection(kind: string, id: string): Promise<DeleteResult> {
  const auth = await authorizeAction("content.delete");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!isKind(kind) || !UUID_RE.test(id)) return { ok: false, error: "Invalid request." };
  const cfg = CFG[kind];

  const { data, error: readError } = await staff.supabase
    .from(cfg.table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readError) return { ok: false, error: friendlyDbError(readError, cfg.parentNoun) };
  const row = data as unknown as Row | null;
  if (!row) return { ok: false, error: `This ${cfg.noun} was not found.` };
  if (row.status !== "draft") {
    return { ok: false, error: `Only a draft ${cfg.noun} can be deleted. Archive it instead.` };
  }
  const parentId = String(row[cfg.parentCol]);

  const checks =
    kind === "subject"
      ? [{ label: "topic(s)", q: staff.supabase.from("topics").select("id", { count: "exact", head: true }).eq("subject_id", id) }]
      : [
          { label: "sub-topic(s)", q: staff.supabase.from("topics").select("id", { count: "exact", head: true }).eq("parent_topic_id", id) },
          { label: "lecture(s)", q: staff.supabase.from("lectures").select("id", { count: "exact", head: true }).eq("topic_id", id) },
          { label: "question(s)", q: staff.supabase.from("questions").select("id", { count: "exact", head: true }).eq("topic_id", id) },
        ];
  const results = await Promise.all(checks.map((c) => c.q));
  if (results.some((r) => r.error)) {
    return { ok: false, error: "Could not check whether this item is in use. Nothing was deleted." };
  }
  const blockers = results
    .map((r, i) => ((r.count ?? 0) > 0 ? `${r.count} ${checks[i].label}` : null))
    .filter((b): b is string => b !== null);
  if (blockers.length > 0) {
    return { ok: false, error: `This ${cfg.noun} cannot be deleted because it contains ${blockers.join(", ")}. Archive it instead.` };
  }

  const { data: deleted, error } = await staff.supabase
    .from(cfg.table)
    .delete()
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23503"
          ? `This ${cfg.noun} is still linked to other records (for example question tags), so it cannot be deleted. Archive it instead.`
          : friendlyDbError(error, cfg.parentNoun),
    };
  }
  if (!deleted) return { ok: false, error: "It could not be deleted. Refresh and try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: `${kind}.delete`,
    entityType: kind,
    entityId: id,
    details: { title: row.title, slug: row.slug },
  });

  revalidatePath(cfg.parentPath(parentId));
  return { ok: true, redirectTo: cfg.parentPath(parentId) };
}

/**
 * Moves an item one place up or down among its siblings (administrators only).
 * Siblings are renumbered 10, 20, 30... so equal numbers never block a move.
 * Note: the renumbering is several small updates, not one transaction.
 */
export async function moveSection(
  kind: string,
  id: string,
  direction: string,
): Promise<SimpleResult> {
  const auth = await authorizeAction("content.publish");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!isKind(kind) || !UUID_RE.test(id)) return { ok: false, error: "Invalid request." };
  if (direction !== "up" && direction !== "down") return { ok: false, error: "Invalid direction." };
  const cfg = CFG[kind];

  const { data: itemData, error: itemError } = await staff.supabase
    .from(cfg.table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (itemError) return { ok: false, error: friendlyDbError(itemError, cfg.parentNoun) };
  const item = itemData as unknown as Row | null;
  if (!item) return { ok: false, error: `This ${cfg.noun} was not found.` };
  const parentId = String(item[cfg.parentCol]);

  const { data: siblingData, error: siblingError } = await staff.supabase
    .from(cfg.table)
    .select("id, sort_order")
    .eq(cfg.parentCol, parentId)
    .order("sort_order")
    .order("title")
    .order("id");
  if (siblingError) return { ok: false, error: friendlyDbError(siblingError, cfg.parentNoun) };
  const siblings = (siblingData ?? []) as { id: string; sort_order: number }[];

  const index = siblings.findIndex((s) => s.id === id);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= siblings.length) return { ok: true }; // already at the end

  const reordered = [...siblings];
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  const step = reordered.length * 10 <= SORT_MAX ? 10 : 1;

  for (let i = 0; i < reordered.length; i++) {
    const newOrder = (i + 1) * step;
    if (reordered[i].sort_order === newOrder) continue;
    const { error } = await staff.supabase
      .from(cfg.table)
      .update({ sort_order: newOrder })
      .eq("id", reordered[i].id);
    if (error) return { ok: false, error: friendlyDbError(error, cfg.parentNoun) };
  }

  await writeAuditLog({
    actorUserId: staff.userId,
    action: `${kind}.reorder`,
    entityType: kind,
    entityId: id,
    details: { direction, title: item.title },
  });

  revalidatePath(cfg.parentPath(parentId));
  revalidatePath("/learn");
  return { ok: true };
}