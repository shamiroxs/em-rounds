import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StaffContext } from "@/lib/admin/access";

export type TagOption = { id: string; label: string };

export async function loadTagOptions(supabase: SupabaseClient): Promise<TagOption[]> {
  const { data, error } = await supabase
    .from("question_tags")
    .select("id, label")
    .order("label")
    .limit(500);
  if (error) throw new Error("Could not load tags");
  return (data ?? []) as unknown as TagOption[];
}

export type QuestionEditorData = {
  question: {
    id: string;
    topic_id: string;
    question_code: string | null;
    status: "draft" | "published" | "archived";
    created_at: string;
    updated_at: string;
  };
  versions: {
    id: string;
    version_number: number;
    stem: string;
    difficulty: string;
    status: string;
    published_at: string | null;
    created_at: string;
  }[];
  latest: {
    id: string;
    version_number: number;
    stem: string;
    difficulty: string;
    status: string;
  };
  options: { id: string; label: string; text: string }[];
  tagIds: string[];
  correctIndex: number; // -1 if no correct answer is stored
  explanation: string;
};

/**
 * Loads a question for the admin editor. The correct answer and explanation
 * live in the private schema and are read through a server-only database
 * function. Call this only AFTER requireCapability("content.edit").
 */
export async function loadQuestionEditorData(
  staff: StaffContext,
  questionId: string,
): Promise<QuestionEditorData | null> {
  const { data: q, error: qError } = await staff.supabase
    .from("questions")
    .select("id, topic_id, question_code, status, created_at, updated_at")
    .eq("id", questionId)
    .maybeSingle();
  if (qError) throw new Error("Could not load the question");
  if (!q) return null;

  const { data: versionRows, error: vError } = await staff.supabase
    .from("question_versions")
    .select("id, version_number, stem, difficulty, status, published_at, created_at")
    .eq("question_id", questionId)
    .order("version_number", { ascending: false });
  if (vError) throw new Error("Could not load the question versions");
  const versions = (versionRows ?? []) as unknown as QuestionEditorData["versions"];
  if (versions.length === 0) return null;
  const latest = versions[0];

  const [optionsRes, tagsRes] = await Promise.all([
    staff.supabase
      .from("question_options")
      .select("id, option_label, option_text, sort_order")
      .eq("question_version_id", latest.id)
      .order("sort_order"),
    staff.supabase.from("question_tag_map").select("tag_id").eq("question_version_id", latest.id),
  ]);
  if (optionsRes.error || tagsRes.error) throw new Error("Could not load the question content");

  const options = ((optionsRes.data ?? []) as unknown as {
    id: string;
    option_label: string;
    option_text: string;
  }[]).map((o) => ({ id: o.id, label: o.option_label, text: o.option_text }));

  const admin = createAdminClient();
  if (!admin) throw new Error("The server is not configured to read answer keys");
  const { data: secrets, error: sError } = await admin.rpc("admin_get_question_secrets", {
    p_version_id: latest.id,
    p_actor: staff.userId,
  });
  if (sError) throw new Error("Could not load the answer key");
  const secret = ((secrets ?? []) as { out_correct_option_id: string | null; out_explanation: string | null }[])[0];

  return {
    question: q as unknown as QuestionEditorData["question"],
    versions,
    latest,
    options,
    tagIds: ((tagsRes.data ?? []) as unknown as { tag_id: string }[]).map((t) => t.tag_id),
    correctIndex: options.findIndex((o) => o.id === secret?.out_correct_option_id),
    explanation: secret?.out_explanation ?? "",
  };
}