"use server";

import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_RE } from "@/lib/learning";
import { canTransition, slugify, type ContentStatus, type FieldErrors } from "@/lib/admin/validation";
import {
  OPTION_LABELS,
  validateQuestionInput,
  validateTagLabel,
} from "@/lib/admin/question-validation";

// SECURITY NOTE: correct answers and explanations are NEVER written to the audit log.

export type SaveQuestionResult =
  | { ok: true; questionId: string; versionNumber: number; createdNewVersion: boolean }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

export type SimpleResult = { ok: true } | { ok: false; error: string };

type RpcError = { code?: string; message?: string };

function mapRpcError(error: RpcError): { error: string; fieldErrors?: FieldErrors } {
  const message = error.message ?? "";
  if (message.startsWith("validation: ")) return { error: message.slice("validation: ".length) };
  if (message.startsWith("forbidden: ")) return { error: message.slice("forbidden: ".length) };
  if (error.code === "23505") {
    return { error: "That question code is already used.", fieldErrors: { code: "That question code is already used." } };
  }
  if (error.code === "23503") return { error: "A selected topic or tag no longer exists." };
  console.error("Question RPC error:", error.code, message.slice(0, 200));
  return { error: "Something went wrong while saving. Please try again." };
}

export async function saveQuestion(
  questionId: string | null,
  input: unknown,
): Promise<SaveQuestionResult> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (questionId !== null && !UUID_RE.test(questionId)) return { ok: false, error: "Invalid question." };

  const parsed = validateQuestionInput(input);
  if (!parsed.ok) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: parsed.fieldErrors };
  }
  const v = parsed.value;

  // Friendly early check. The database function enforces the same rule.
  if (questionId !== null && !staff.can("content.publish")) {
    const { data } = await staff.supabase.from("questions").select("status").eq("id", questionId).maybeSingle();
    if (!data) return { ok: false, error: "Question not found." };
    if ((data as { status: string }).status !== "draft") {
      return { ok: false, error: "Only an administrator can edit a question that is published or archived." };
    }
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "The server is not configured to save questions." };

  const { data, error } = await admin.rpc("admin_save_question_draft", {
    p_question_id: questionId,
    p_topic_id: v.topicId,
    p_question_code: v.code,
    p_stem: v.stem,
    p_difficulty: v.difficulty,
    p_options: v.options.map((text, i) => ({ label: OPTION_LABELS[i], text })),
    p_correct_label: OPTION_LABELS[v.correctIndex],
    p_explanation: v.explanation,
    p_tag_ids: v.tagIds,
    p_actor: staff.userId,
  });
  if (error) {
    const mapped = mapRpcError(error);
    return { ok: false, ...mapped };
  }

  const row = ((data ?? []) as {
    out_question_id: string;
    out_version_number: number;
    out_created_new_version: boolean;
  }[])[0];
  if (!row) return { ok: false, error: "The question could not be saved. Please try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action:
      questionId === null ? "question.create" : row.out_created_new_version ? "question.new_version" : "question.update",
    entityType: "question",
    entityId: row.out_question_id,
    details: {
      version_number: row.out_version_number,
      topic_id: v.topicId,
      difficulty: v.difficulty,
      option_count: v.options.length,
      tag_count: v.tagIds.length,
    },
  });

  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${row.out_question_id}`);
  return {
    ok: true,
    questionId: row.out_question_id,
    versionNumber: row.out_version_number,
    createdNewVersion: row.out_created_new_version,
  };
}

export async function publishQuestion(questionId: string): Promise<SimpleResult> {
  const auth = await authorizeAction("content.publish");
  if (!auth.ok) return auth;
  const { staff } = auth;
  if (!UUID_RE.test(questionId)) return { ok: false, error: "Invalid question." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "The server is not configured to publish questions." };

  const { data, error } = await admin.rpc("admin_publish_question", {
    p_question_id: questionId,
    p_actor: staff.userId,
  });
  if (error) return { ok: false, error: mapRpcError(error).error };

  const row = ((data ?? []) as { out_version_number: number }[])[0];
  await writeAuditLog({
    actorUserId: staff.userId,
    action: "question.publish",
    entityType: "question",
    entityId: questionId,
    details: { version_number: row?.out_version_number ?? null },
  });

  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${questionId}`);
  return { ok: true };
}

/** Unpublish (published -> draft), archive, or restore (archived -> draft). Administrators only. */
export async function setQuestionStatus(questionId: string, next: string): Promise<SimpleResult> {
  const auth = await authorizeAction("content.publish");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!UUID_RE.test(questionId)) return { ok: false, error: "Invalid question." };
  if (next !== "draft" && next !== "archived") return { ok: false, error: "Invalid status." };

  const { data, error: readError } = await staff.supabase
    .from("questions")
    .select("id, status")
    .eq("id", questionId)
    .maybeSingle();
  if (readError) return { ok: false, error: "Could not load the question. Please try again." };
  const question = data as { id: string; status: ContentStatus } | null;
  if (!question) return { ok: false, error: "Question not found." };

  if (!canTransition(question.status, next as ContentStatus)) {
    return { ok: false, error: `A ${question.status} question cannot be changed to ${next}.` };
  }

  const { data: updated, error } = await staff.supabase
    .from("questions")
    .update({ status: next })
    .eq("id", questionId)
    .eq("status", question.status)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Could not update the question. Please try again." };
  if (!updated) return { ok: false, error: "The question changed while you were working. Refresh and try again." };

  const action =
    next === "archived" ? "archive" : question.status === "published" ? "unpublish" : "restore";
  await writeAuditLog({
    actorUserId: staff.userId,
    action: `question.${action}`,
    entityType: "question",
    entityId: questionId,
    details: { from: question.status, to: next },
  });

  revalidatePath("/admin/questions");
  revalidatePath(`/admin/questions/${questionId}`);
  return { ok: true };
}

/** Creates a tag (or returns the existing one with the same name). */
export async function createTag(
  label: string,
): Promise<{ ok: true; tag: { id: string; label: string } } | { ok: false; error: string }> {
  const auth = await authorizeAction("content.edit");
  if (!auth.ok) return auth;
  const { staff } = auth;

  const parsed = validateTagLabel(label);
  if (!parsed.ok) return parsed;
  const slug = slugify(parsed.value);
  if (!slug) return { ok: false, error: "Use letters or numbers in the tag name." };

  const { data, error } = await staff.supabase
    .from("question_tags")
    .insert({ slug, label: parsed.value })
    .select("id, label")
    .single();

  if (error?.code === "23505") {
    const { data: existing } = await staff.supabase
      .from("question_tags")
      .select("id, label")
      .eq("slug", slug)
      .maybeSingle();
    if (existing) return { ok: true, tag: existing as { id: string; label: string } };
  }
  if (error || !data) return { ok: false, error: "Could not create the tag. Please try again." };

  await writeAuditLog({
    actorUserId: staff.userId,
    action: "question_tag.create",
    entityType: "question_tag",
    entityId: (data as { id: string }).id,
    details: { label: parsed.value },
  });
  return { ok: true, tag: data as { id: string; label: string } };
}