import { createClient } from "@/lib/supabase/server";

// For API routes: returns null (so the route can send 401) instead of redirecting.
export async function getAuthedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const userId = claims?.sub;
  if (error || !claims || typeof userId !== "string" || !userId) return null;
  const email = typeof claims.email === "string" ? claims.email : undefined;
  return { userId, email };
}