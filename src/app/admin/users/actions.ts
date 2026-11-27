"use server";

import { revalidatePath } from "next/cache";
import { authorizeAction } from "@/lib/admin/access";
import { writeAuditLog } from "@/lib/admin/audit";
import { UUID_RE } from "@/lib/learning";

export type RoleResult = { ok: true; message: string } | { ok: false; error: string };

// Only the OWNER may change roles, and only these two. The owner_admin role is
// never granted or removed here, so nobody can create a second owner or strip the
// last one from this screen.
const ASSIGNABLE = ["content_editor", "admin"] as const;

export async function setUserRole(userId: string, role: string, grant: boolean): Promise<RoleResult> {
  const auth = await authorizeAction("roles.manage");
  if (!auth.ok) return auth;
  const { staff } = auth;

  if (!UUID_RE.test(userId)) return { ok: false, error: "Invalid user." };
  if (!(ASSIGNABLE as readonly string[]).includes(role)) return { ok: false, error: "That role cannot be changed here." };
  if (userId === staff.userId) return { ok: false, error: "You cannot change your own roles." };

  const { data: profile, error: profileError } = await staff.supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) return { ok: false, error: "Could not load the user. Please try again." };
  if (!profile) return { ok: false, error: "User not found." };

  const { data: targetRoles, error: rolesError } = await staff.supabase
    .from("user_roles")
    .select("roles(code)")
    .eq("user_id", userId);
  if (rolesError) return { ok: false, error: "Could not read the user's roles. Please try again." };
  const codes = ((targetRoles ?? []) as unknown as { roles: { code: string } | null }[])
    .map((r) => r.roles?.code)
    .filter((c): c is string => !!c);
  if (codes.includes("owner_admin")) return { ok: false, error: "An owner account's roles cannot be changed here." };

  const { data: roleRow, error: roleError } = await staff.supabase
    .from("roles")
    .select("id")
    .eq("code", role)
    .maybeSingle();
  if (roleError || !roleRow) return { ok: false, error: "That role was not found." };
  const roleId = (roleRow as { id: number }).id;

  if (grant) {
    if (codes.includes(role)) return { ok: true, message: "They already have that role." };
    const { error } = await staff.supabase
      .from("user_roles")
      .insert({ user_id: userId, role_id: roleId, assigned_by: staff.userId });
    if (error) {
      console.error("Role grant failed:", error.code, error.message);
      return { ok: false, error: "Could not grant the role. Please try again." };
    }
  } else {
    if (!codes.includes(role)) return { ok: true, message: "They do not have that role." };
    const { error } = await staff.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role_id", roleId);
    if (error) {
      console.error("Role revoke failed:", error.code, error.message);
      return { ok: false, error: "Could not remove the role. Please try again." };
    }
  }

  await writeAuditLog({
    actorUserId: staff.userId,
    action: grant ? "user.role_grant" : "user.role_revoke",
    entityType: "user",
    entityId: userId,
    details: { role },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${userId}`);
  return { ok: true, message: grant ? "Role granted." : "Role removed." };
}