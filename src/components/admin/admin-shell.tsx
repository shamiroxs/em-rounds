"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  Megaphone,
  Menu,
  Users,
  Video,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/auth/sign-out-button";
import type { AdminIconKey, AdminNavItem } from "./nav-config";

const ICONS: Record<AdminIconKey, typeof BookOpen> = {
  overview: LayoutDashboard,
  courses: BookOpen,
  lectures: Video,
  questions: ClipboardList,
  announcements: Megaphone,
  users: Users,
  audit: History,
};

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

function NavList({
  items,
  pathname,
}: {
  items: AdminNavItem[];
  pathname: string;
}) {
  return (
    <nav className="admin-nav" aria-label="Administration">
      {items.map(({ href, label, icon, available }) => {
        const Icon = ICONS[icon];
        if (!available) {
          return (
            <span key={href} className="admin-nav-link" aria-disabled="true">
              <Icon size={18} aria-hidden />
              {label}
              <span className="admin-soon">Soon</span>
            </span>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            className="admin-nav-link"
            aria-current={isActive(pathname, href) ? "page" : undefined}
          >
            <Icon size={18} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  items,
  roleLabel,
  email,
  children,
}: {
  items: AdminNavItem[];
  roleLabel: string;
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // The drawer is "open" only for the page it was opened on, so it closes by
  // itself after navigating. No effect is needed for that.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const drawerOpen = openPath === pathname;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPath(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const sidebar = (
    <>
      <div className="admin-brand-row">
        <Link href="/admin" className="brand">
          EM ROUNDS <span className="brand-accent">with PK</span>
        </Link>
        <p className="admin-eyebrow">Administration</p>
      </div>
      <NavList items={items} pathname={pathname} />
      <div className="admin-sidebar-foot">
        <div>
          <span className="role-pill">{roleLabel}</span>
          {email && <p className="admin-email" title={email}>{email}</p>}
        </div>
        <Link href="/learn" className="admin-nav-link">
          <GraduationCap size={18} aria-hidden /> Student view
        </Link>
        <SignOutButton />
      </div>
    </>
  );

  return (
    <div className="app-shell admin-root">
      <header className="admin-topbar">
        <button
          type="button"
          className="admin-icon-btn"
          aria-label="Open navigation menu"
          aria-expanded={drawerOpen}
          aria-controls="admin-drawer"
          onClick={() => setOpenPath(pathname)}
        >
          <Menu size={24} aria-hidden />
        </button>
        <Link href="/admin" className="brand">
          EM ROUNDS <span className="brand-accent">Admin</span>
        </Link>
        <ThemeToggle />
      </header>

      {drawerOpen && (
        <div
          className="admin-backdrop"
          onClick={() => setOpenPath(null)}
          aria-hidden="true"
        />
      )}
      <aside
        id="admin-drawer"
        className="admin-sidebar"
        data-open={drawerOpen ? "true" : "false"}
        aria-label="Administration sidebar"
      >
        <button
          type="button"
          className="admin-icon-btn admin-drawer-close"
          aria-label="Close navigation menu"
          onClick={() => setOpenPath(null)}
        >
          <X size={22} aria-hidden />
        </button>
        {sidebar}
      </aside>

      <div className="admin-main">
        <div className="admin-desktop-bar">
          <ThemeToggle />
        </div>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}
