import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const instant = false;

export default async function AdminPage() {
  await requireAdmin();

  return (
    <main className="app-shell">
      <header className="site-header mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Link href="/account" className="brand">EM ROUNDS <span className="brand-accent">with PK</span></Link>
        <SignOutButton />
      </header>
      <section className="mx-auto max-w-5xl px-5 py-10">
        <p className="eyebrow">Restricted area</p>
        <h1 className="section-title mt-3 text-3xl">Administration</h1>
        <p className="muted-copy mt-4 max-w-2xl text-sm leading-7">Your database-verified administrator access is confirmed. Administrative tools have not been added in this authentication phase.</p>
      </section>
    </main>
  );
}
