import type { SupabaseClient } from "@supabase/supabase-js";

/** A number from the database, or null if the query failed (never a fake 0). */
export type Stat = number | null;

export type DashboardStats = {
  courses: Stat;
  publishedCourses: Stat;
  subjects: Stat;
  topics: Stat;
  lectures: Stat;
  publishedLectures: Stat;
  students: Stat;
  staffAccounts: Stat;
};

/**
 * Every new account gets the "student" role (database trigger), so staff are
 * students too. "Registered students" therefore means: all accounts that do
 * not hold any staff role.
 */
export function countStudents(totalAccounts: number, staffUserIds: string[]) {
  const staff = new Set(staffUserIds).size;
  return { students: Math.max(totalAccounts - staff, 0), staff };
}

async function count(
  supabase: SupabaseClient,
  table: string,
  status?: string,
): Promise<Stat> {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count: n, error } = await query;
  if (error) {
    console.error(`Dashboard count failed for ${table}:`, error.code, error.message);
    return null;
  }
  return n ?? 0;
}

/**
 * Reads the dashboard numbers under the signed-in administrator's own session.
 * RLS decides what is visible; the caller must already have checked the role.
 */
export async function loadDashboardStats(
  supabase: SupabaseClient,
): Promise<DashboardStats> {
  const [
    courses,
    publishedCourses,
    subjects,
    topics,
    lectures,
    publishedLectures,
    profileCount,
    staffRows,
  ] = await Promise.all([
    count(supabase, "courses"),
    count(supabase, "courses", "published"),
    count(supabase, "subjects"),
    count(supabase, "topics"),
    count(supabase, "lectures"),
    count(supabase, "lectures", "published"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("user_roles")
      .select("user_id, roles!inner(code)")
      .in("roles.code", ["content_editor", "admin", "owner_admin"]),
  ]);

  let students: Stat = null;
  let staffAccounts: Stat = null;
  if (profileCount.error || staffRows.error || profileCount.count === null) {
    console.error(
      "Dashboard student count failed:",
      profileCount.error?.message ?? staffRows.error?.message,
    );
  } else {
    const ids = (staffRows.data ?? []).map((r) => r.user_id as string);
    const result = countStudents(profileCount.count, ids);
    students = result.students;
    staffAccounts = result.staff;
  }

  return {
    courses,
    publishedCourses,
    subjects,
    topics,
    lectures,
    publishedLectures,
    students,
    staffAccounts,
  };
}

export type ActivityRow = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  actor: string | null;
};

export async function loadRecentActivity(
  supabase: SupabaseClient,
  limit = 8,
): Promise<{ rows: ActivityRow[]; failed: boolean }> {
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("id, actor_user_id, action, entity_type, entity_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("Recent activity failed:", error.code, error.message);
    return { rows: [], failed: true };
  }

  const actorIds = [
    ...new Set((data ?? []).map((r) => r.actor_user_id).filter(Boolean)),
  ] as string[];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", actorIds);
    for (const p of profiles ?? []) {
      if (p.display_name) names.set(p.id, p.display_name);
    }
  }

  return {
    failed: false,
    rows: (data ?? []).map((r) => ({
      id: r.id as number,
      action: r.action as string,
      entity_type: r.entity_type as string,
      entity_id: (r.entity_id as string | null) ?? null,
      created_at: r.created_at as string,
      actor: r.actor_user_id
        ? (names.get(r.actor_user_id as string) ?? "Administrator")
        : "Removed account",
    })),
  };
}
