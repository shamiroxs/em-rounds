import { Suspense } from "react";
import { Toaster } from "sonner";
import { requireStaff, ROLE_LABEL } from "@/lib/admin/access";
import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_NAV } from "@/components/admin/nav-config";
import { AdminSkeleton } from "@/components/admin/ui";

export const instant = false;

// Reads the session inside <Suspense> (required by Cache Components), checks
// the role on the server, and only then renders the administration shell.
//
// IMPORTANT: a layout is NOT a security boundary on its own. Every admin page
// and every server action ALSO checks the role itself.
async function AdminGate({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff();
  // Hiding links is only a convenience. Pages and actions enforce access.
  const items = ADMIN_NAV.filter(
    (item) => item.capability === null || staff.can(item.capability),
  );
  return (
    <AdminShell
      items={items}
      roleLabel={ROLE_LABEL[staff.role]}
      email={staff.email}
    >
      {children}
    </AdminShell>
  );
}

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Suspense
        fallback={
          <div className="app-shell">
            <div className="admin-content">
              <AdminSkeleton />
            </div>
          </div>
        }
      >
        <AdminGate>{children}</AdminGate>
      </Suspense>
      <Toaster richColors position="top-center" />
    </>
  );
}
