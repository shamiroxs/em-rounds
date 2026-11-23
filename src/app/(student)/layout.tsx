import { Suspense } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import { requireUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav, TopNav } from "@/components/student-nav";

// Checks the login inside a Suspense boundary, then shows the page.
async function AuthGate({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <>{children}</>;
}

function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: "2rem", width: "50%" }} />
      <div className="card-grid">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton" style={{ height: "14rem" }} />
        ))}
      </div>
    </div>
  );
}

export default function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/learn" className="brand">
          EM ROUNDS <span className="brand-accent">with PK</span>
        </Link>
        <Suspense fallback={<nav className="nav-links" aria-label="Main" />}>
          <TopNav />
        </Suspense>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/account" className="text-link">Account</Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="page-container">
        <Suspense fallback={<PageSkeleton />}>
          <AuthGate>{children}</AuthGate>
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <BottomNav />
      </Suspense>
      <Toaster richColors position="top-center" />
    </div>
  );
}