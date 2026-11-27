import type { StaffContext } from "@/lib/admin/access";
import { createAdminClient } from "@/lib/supabase/admin";

// SECURITY: this module reads auth.users through the server-only service role.
// It returns ONLY small, safe fields (never passwords, tokens or metadata).
// Callers must have checked the "users.view" capability; this re-checks it.

export const DIRECTORY_CAP = 1000;
const STAFF_CODES = ["content_editor", "admin", "owner_admin"];

export type UserSummary = {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  roles: string[]; // staff roles only
  platformAccess: boolean;
  courseAccessCount: number;
};

export type UserDetail = UserSummary & {
  emailConfirmed: boolean;
  suspended: boolean;
  allRoles: string[];
  entitlements: {
    id: string;
    scope: string;
    courseTitle: string | null;
    status: string;
    startsAt: string;
    expiresAt: string | null;
    revokedAt: string | null;
    current: boolean;
  }[];
};

type EntRow = {
  user_id: string;
  scope_type: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
};

function isCurrent(e: Pick<EntRow, "status" | "starts_at" | "expires_at">, now: number) {
  return (
    e.status === "active" &&
    new Date(e.starts_at).getTime() <= now &&
    (!e.expires_at || new Date(e.expires_at).getTime() > now)
  );
}

export async function loadUserDirectory(
  staff: StaffContext,
): Promise<{ users: UserSummary[]; capped: boolean }> {
  if (!staff.can("users.view")) throw new Error("Not authorized");
  const admin = createAdminClient();
  if (!admin) throw new Error("Service role is not configured");

  const [authRes, profilesRes, rolesRes, entRes] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: DIRECTORY_CAP }),
    staff.supabase.from("profiles").select("id, display_name").limit(5000),
    staff.supabase.from("user_roles").select("user_id, roles(code)").limit(10000),
    staff.supabase
      .from("entitlements")
      .select("user_id, scope_type, status, starts_at, expires_at")
      .eq("status", "active")
      .limit(10000),
  ]);
  if (authRes.error || profilesRes.error || rolesRes.error || entRes.error) {
    throw new Error("Could not load users");
  }

  const names = new Map<string, string | null>();
  for (const p of (profilesRes.data ?? []) as unknown as { id: string; display_name: string | null }[]) {
    names.set(p.id, p.display_name);
  }
  const roles = new Map<string, string[]>();
  for (const r of (rolesRes.data ?? []) as unknown as { user_id: string; roles: { code: string } | null }[]) {
    const code = r.roles?.code;
    if (code && STAFF_CODES.includes(code)) roles.set(r.user_id, [...(roles.get(r.user_id) ?? []), code]);
  }
  const now = Date.now();
  const access = new Map<string, { platform: boolean; courses: number }>();
  for (const e of (entRes.data ?? []) as unknown as EntRow[]) {
    if (!isCurrent(e, now)) continue;
    const cur = access.get(e.user_id) ?? { platform: false, courses: 0 };
    if (e.scope_type === "platform") cur.platform = true;
    else cur.courses += 1;
    access.set(e.user_id, cur);
  }

  const users = authRes.data.users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    displayName: names.get(u.id) ?? null,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    roles: roles.get(u.id) ?? [],
    platformAccess: access.get(u.id)?.platform ?? false,
    courseAccessCount: access.get(u.id)?.courses ?? 0,
  }));

  return { users, capped: authRes.data.users.length >= DIRECTORY_CAP };
}

export async function loadUserDetail(staff: StaffContext, userId: string): Promise<UserDetail | null> {
  if (!staff.can("users.view")) throw new Error("Not authorized");
  const admin = createAdminClient();
  if (!admin) throw new Error("Service role is not configured");

  const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
  if (authError) {
    if ((authError as { status?: number }).status === 404) return null;
    throw new Error("Could not load the user");
  }
  const u = authData.user;
  if (!u) return null;

  const [profileRes, rolesRes, entRes] = await Promise.all([
    staff.supabase.from("profiles").select("id, display_name").eq("id", userId).maybeSingle(),
    staff.supabase.from("user_roles").select("user_id, roles(code)").eq("user_id", userId),
    staff.supabase
      .from("entitlements")
      .select("id, user_id, scope_type, status, starts_at, expires_at, revoked_at, courses(title)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (profileRes.error || rolesRes.error || entRes.error) throw new Error("Could not load the user");

  const allRoles = ((rolesRes.data ?? []) as unknown as { roles: { code: string } | null }[])
    .map((r) => r.roles?.code)
    .filter((c): c is string => !!c);

  type EntFull = EntRow & {
    id: string;
    revoked_at: string | null;
    courses: { title: string } | null;
  };
  const now = Date.now();
  const entitlements = ((entRes.data ?? []) as unknown as EntFull[]).map((e) => ({
    id: e.id,
    scope: e.scope_type,
    courseTitle: e.courses?.title ?? null,
    status: e.status,
    startsAt: e.starts_at,
    expiresAt: e.expires_at,
    revokedAt: e.revoked_at,
    current: isCurrent(e, now),
  }));

  const bannedUntil = (u as { banned_until?: string | null }).banned_until;
  return {
    id: u.id,
    email: u.email ?? null,
    displayName: (profileRes.data as { display_name: string | null } | null)?.display_name ?? null,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    roles: allRoles.filter((c) => STAFF_CODES.includes(c)),
    allRoles,
    platformAccess: entitlements.some((e) => e.current && e.scope === "platform"),
    courseAccessCount: entitlements.filter((e) => e.current && e.scope === "course").length,
    emailConfirmed: !!u.email_confirmed_at,
    suspended: !!bannedUntil && new Date(bannedUntil).getTime() > now,
    entitlements,
  };
}