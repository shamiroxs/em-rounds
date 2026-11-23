import Link from "next/link";
import { Toaster } from "sonner";
import { requireUser } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { BottomNav, TopNav } from "@/components/student-nav";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser();

  return (
    <div className="app-shell">
      <header className="app-header">
        <Link href="/learn" className="brand">
          EM ROUNDS <span className="brand-accent">with PK</span>
        </Link>
        <TopNav />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Link href="/account" className="text-link">Account</Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="page-container">{children}</main>
      <BottomNav />
      <Toaster richColors position="top-center" />
    </div>
  );
}