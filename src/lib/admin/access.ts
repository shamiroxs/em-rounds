import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Roles that may use the administration area. These mirror the existing
// database roles (public.roles); no new role system is created here.
export type StaffRole = "owner_admin" | "admin" | "content_editor";

export type Capability =
  | "content.edit" // create/edit DRAFT educational content (editors + admins)
  | "content.publish" // publish, unpublish, archive (admins only)
  | "content.delete" // delete empty draft records (admins only)
  | "dashboard.view"
  | "announcements.manage"
  | "users.view"
  | "audit.view"
  | "roles.manage"; // owner_admin only, also enforced by RLS

const CAPABILITIES: Record<StaffRole, ReadonlySet<Capability>> = {
  content_editor: new Set<Capability>(["content.edit"]),
  admin: new Set<Capability>([
    "content.edit",
    "content.publish",
    "content.delete",
    "dashboard.view",
    "announcements.manage",
    "users.view",
    "audit.view",
  ]),
  owner_admin: new Set<Capability>([
    "content.edit",
    "content.publish",
    "content.delete",
    "dashboard.view",
    "announcements.manage",
    "users.view",
    "audit.view",
    "roles.manage",
  ]),
};

export function roleCan(role: StaffRole, capability: Capability) {
  return CAPABILITIES[role].has(capability);
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner_admin: "Owner admin",
  admin: "Administrator",
  content_editor: "Content editor",
};

export type StaffContext = {
  supabase: SupabaseClient;
  userId: string;
  email: string | null;
  role: StaffRole;
  can: (capability: Capability) => boolean;
};

/**
 * Returns the signed-in staff member, or null. Never redirects, so server
 * actions can return a clean error. It FAILS CLOSED: any database error,
 * missing session, or student account returns null.
 *
 * The role is read from the database through the existing helper functions
 * (has_role / is_admin), under the user's own session. Nothing here trusts
 * the browser.
 */
export const getStaff = cache(async (): Promise<StaffContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  if (error || typeof userId !== "string" || !userId || !claims) return null;

  const [owner, admin, editor] = await Promise.all([
    supabase.rpc("has_role", { required_role: "owner_admin" }),
    supabase.rpc("is_admin"),
    supabase.rpc("has_role", { required_role: "content_editor" }),
  ]);
  if (owner.error || admin.error || editor.error) return null;

  const role: StaffRole | null =
    owner.data === true
      ? "owner_admin"
      : admin.data === true
        ? "admin"
        : editor.data === true
          ? "content_editor"
          : null;
  if (!role) return null;

  return {
    supabase,
    userId,
    email: typeof claims.email === "string" ? claims.email : null,
    role,
    can: (capability) => roleCan(role, capability),
  };
});

/** For pages: unauthenticated -> /login, signed-in non-staff -> /account. */
export async function requireStaff(): Promise<StaffContext> {
  const staff = await getStaff();
  if (staff) return staff;

  // Tell "not signed in" apart from "signed in but not staff".
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) redirect("/login");
  redirect("/account?error=admin_access_required");
}

/** For pages that only administrators may open (not content editors). */
export async function requireCapability(
  capability: Capability,
): Promise<StaffContext> {
  const staff = await requireStaff();
  if (!staff.can(capability)) redirect("/admin");
  return staff;
}

export type ActionResult<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/**
 * For server actions. Call this FIRST in every admin action:
 *   const auth = await authorizeAction("content.publish");
 *   if (!auth.ok) return auth;
 */
export async function authorizeAction(
  capability: Capability,
): Promise<{ ok: true; staff: StaffContext } | { ok: false; error: string }> {
  const staff = await getStaff();
  if (!staff) return { ok: false, error: "You are not authorized to do this." };
  if (!staff.can(capability)) {
    return { ok: false, error: "Your role does not allow this action." };
  }
  return { ok: true, staff };
}
