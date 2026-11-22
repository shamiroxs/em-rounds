import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const instant = false;

export default async function AdminPage() {
  await requireAdmin();

  return (
    <main className="min-h-screen bg-[#0B1220] text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Link href="/account" className="font-bold tracking-tight">EM ROUNDS <span className="text-cyan-400">with PK</span></Link>
        <SignOutButton />
      </header>
      <section className="mx-auto max-w-5xl px-5 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">Restricted area</p>
        <h1 className="mt-3 text-3xl font-bold">Administration</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">Your database-verified administrator access is confirmed. Administrative tools have not been added in this authentication phase.</p>
      </section>
    </main>
  );
}
