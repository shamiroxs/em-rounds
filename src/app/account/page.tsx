import Link from "next/link";
import { CheckCircle2, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { BackButton } from "@/components/back-button";

export const instant = false;

export default async function AccountPage() {
  const { supabase, userId, claims } = await requireUser();
  const [
    { data: profile },
    { data: isAdmin },
    { data: isEditor },
    { data: isOwner },
    { data: hasAccess },
    { data: product },
    { data: orders },
  ] = await Promise.all([
    supabase.from("profiles").select("display_name, avatar_url").eq("id", userId).maybeSingle(),
    supabase.rpc("is_admin"),
    supabase.rpc("has_role", { required_role: "content_editor" }),
    supabase.rpc("has_role", { required_role: "owner_admin" }),
    supabase.rpc("has_platform_access"),
    supabase
      .from("access_products")
      .select("amount_minor, currency")
      .eq("code", "lifetime_platform")
      .eq("is_active", true)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id, amount_minor, currency, status, created_at, paid_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const role = isOwner ? "Owner admin" : isAdmin ? "Administrator" : isEditor ? "Content editor" : "Student";
  const email = typeof claims.email === "string" ? claims.email : "Signed-in account";

  const price = product
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: String(product.currency).trim(),
        maximumFractionDigits: 0,
      }).format(Number(product.amount_minor) / 100)
    : null;

  const history = (orders ?? []).filter((o) => o.status !== "created" && o.status !== "cancelled");

  return (
    <main className="app-shell">
      <header className="site-header mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
        <Link href="/home" className="brand">EM ROUNDS <span className="brand-accent">with PK</span></Link>
        <SignOutButton />
      </header>
      <section className="mx-auto max-w-5xl px-5 py-10">
        <BackButton fallbackHref="/home" />
        <p className="eyebrow" style={{ marginTop: "1rem" }}>Learner space</p>
        <h1 className="mt-3 text-3xl font-bold">Your account</h1>

        <div className="surface-card mt-8">
          <p className="text-lg font-semibold">{profile?.display_name || "Welcome"}</p>
          <p className="muted-copy mt-1 text-sm">{email}</p>
          <p className="role-pill mt-5">{role}</p>
        </div>

        <div className="surface-card mt-6">
          <h2 className="section-title" style={{ fontSize: "1.1rem" }}>Access</h2>
          {hasAccess === true ? (
            <p style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.6rem" }}>
              <CheckCircle2 size={20} aria-hidden style={{ color: "var(--success-text)" }} />
              Lifetime access is active.
            </p>
          ) : (
            <>
              <p style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.6rem" }}>
                <Lock size={20} aria-hidden /> You do not have access yet.
              </p>
              {price && (
                <p className="muted-copy" style={{ marginTop: "0.4rem" }}>
                  One-time payment of {price}. No subscription, no renewal.
                </p>
              )}
              <Link href="/checkout?next=/learn" className="primary-button"
                style={{ marginTop: "0.9rem" }}>
                Get lifetime access
              </Link>
            </>
          )}

          {history.length > 0 && (
            <div style={{ marginTop: "1.25rem" }}>
              <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>Payment history</h3>
              {history.map((o) => (
                <p key={o.id} className="muted-copy" style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>
                  {new Date(o.paid_at ?? o.created_at).toLocaleDateString("en-IN")} ·{" "}
                  {new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: String(o.currency).trim(),
                    maximumFractionDigits: 0,
                  }).format(Number(o.amount_minor) / 100)}{" "}
                  · {o.status.replace("_", " ")}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/learn" className="primary-button">Browse courses</Link>
          <Link href="/my-learning" className="secondary-button">My Learning</Link>
        </div>
        {(isAdmin || isEditor) && <Link href="/admin" className="admin-link mt-6">Open administration</Link>}
      </section>
    </main>
  );
}