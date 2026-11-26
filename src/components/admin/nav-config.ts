import type { Capability } from "@/lib/admin/access";

export type AdminIconKey =
  | "overview"
  | "courses"
  | "lectures"
  | "questions"
  | "announcements"
  | "users"
  | "audit";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: AdminIconKey;
  /** Who may see this link. The page itself ALSO enforces this on the server. */
  capability: Capability | null;
  /** false = module not built yet; the link is shown as "Soon" and disabled. */
  available: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: "overview", capability: null, available: true },
  { href: "/admin/courses", label: "Courses", icon: "courses", capability: "content.edit", available: true },
  { href: "/admin/lectures", label: "Lectures", icon: "lectures", capability: "content.edit", available: true },
  { href: "/admin/questions", label: "Questions", icon: "questions", capability: "content.edit", available: false },
  { href: "/admin/announcements", label: "Announcements", icon: "announcements", capability: "announcements.manage", available: false },
  { href: "/admin/users", label: "Users", icon: "users", capability: "users.view", available: false },
  { href: "/admin/audit-log", label: "Audit log", icon: "audit", capability: "audit.view", available: false },
];
