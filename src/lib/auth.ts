import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;

  if (error || typeof userId !== "string" || !userId || !claims) {
    redirect("/login");
  }

  return { supabase, userId, claims };
}

export async function requireAdmin() {
  const context = await requireUser();
  const { data: isAdmin, error } = await context.supabase.rpc("is_admin");

  // Fail closed: a database error must never grant administrative access.
  if (error || isAdmin !== true) {
    redirect("/account?error=admin_access_required");
  }

  return context;
}
