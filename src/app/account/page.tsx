import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const instant = false;

export default async function AccountPage() {
  const { supabase, userId, claims } = await requireUser();
  const [{ data: profile }, { data: isAdmin }, { data: isEditor }, { data: isOwner }] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle(),
    supabase.rpc("is_admin"),
    supabase.rpc("has_role", { required_role: "content_editor" }),
    supabase.rpc("has_role", { required_role: "owner_admin" }),
  ]);

  const role = isOwner ? "Owner admin" : isAdmin ? "Administrator" : isEditor ? "Content editor" : "Student";
  const email = typeof claims.email === "string" ? claims.email : "Signed-in account";

  return (
    <main className="app-shell">
      <header className="site-header mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Link href="/" className="brand">EM ROUNDS <span className="brand-accent">with PK</span></Link>
        <SignOutButton />
      </header>
      <section className="mx-auto max-w-5xl px-5 py-10">
        <p className="eyebrow">Learner space</p>
        <h1 className="mt-3 text-3xl font-bold">Your account</h1>
        <div className="surface-card mt-8">
          <p className="text-lg font-semibold">{profile?.display_name || "Welcome"}</p>
          <p className="muted-copy mt-1 text-sm">{email}</p>
          <p className="role-pill mt-5">{role}</p>
        </div>
        <p className="muted-copy mt-6 text-sm">Your learning dashboard will appear here as platform features are introduced.</p>
        {isAdmin && <Link href="/admin" className="admin-link mt-6">Open administration</Link>}
      </section>
    </main>
  );
}
