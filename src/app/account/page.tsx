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
    <main className="min-h-screen bg-[#0B1220] text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Link href="/" className="font-bold tracking-tight">EM ROUNDS <span className="text-cyan-400">with PK</span></Link>
        <SignOutButton />
      </header>
      <section className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">Learner space</p>
        <h1 className="mt-3 text-3xl font-bold">Your account</h1>
        <div className="mt-8 rounded-2xl border border-slate-700 bg-slate-900 p-6">
          <p className="text-lg font-semibold">{profile?.display_name || "Welcome"}</p>
          <p className="mt-1 text-sm text-slate-400">{email}</p>
          <p className="mt-5 inline-flex rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">{role}</p>
        </div>
        <p className="mt-6 text-sm text-slate-400">Your learning dashboard will appear here as platform features are introduced.</p>
        {isAdmin && <Link href="/admin" className="mt-6 inline-block rounded-lg border border-cyan-700 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-950/40">Open administration</Link>}
      </section>
    </main>
  );
}
