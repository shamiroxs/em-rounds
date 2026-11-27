import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { UUID_RE } from "@/lib/learning";
import { loadUserDetail } from "@/lib/admin/users-data";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";
import { RoleControls } from "@/components/admin/users/role-controls";

export const instant = false;

const ROLE_LABEL: Record<string, string> = { owner_admin: "Owner", admin: "Administrator", content_editor: "Content editor", student: "Student" };

export default async function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const staff = await requireCapability("users.view");
  const { userId } = await params;
  if (!UUID_RE.test(userId)) notFound();

  let user;
  try {
    user = await loadUserDetail(staff, userId);
  } catch {
    return <div className="error-box" role="alert">This user could not be loaded. Refresh the page to try again.</div>;
  }
  if (!user) notFound();

  const isSelf = user.id === staff.userId;
  const isOwner = user.allRoles.includes("owner_admin");
  const canManageRoles = staff.can("roles.manage") && !isSelf && !isOwner;

  return (
    <>
      <Breadcrumbs items={[{ label: "Users", href: "/admin/users" }, { label: user.displayName ?? user.email ?? "User" }]} />
      <PageHeader title={user.displayName ?? user.email ?? "User"} description={user.displayName ? (user.email ?? undefined) : undefined} />

      <div className="admin-form-grid" style={{ maxWidth: "52rem" }}>
        <section className="surface-card" aria-labelledby="account-heading">
          <h2 id="account-heading" className="section-title admin-section-title">Account</h2>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "max-content 1fr", gap: "0.5rem 1.2rem", fontSize: "0.92rem" }}>
            <dt className="muted-copy">User ID</dt><dd style={{ margin: 0, overflowWrap: "anywhere" }}><code>{user.id}</code></dd>
            <dt className="muted-copy">Email</dt><dd style={{ margin: 0 }}>{user.email ?? "—"} {user.email && (user.emailConfirmed ? <span className="admin-badge admin-badge--ok">Confirmed</span> : <span className="admin-badge admin-badge--warn">Not confirmed</span>)}</dd>
            <dt className="muted-copy">Joined</dt><dd style={{ margin: 0 }}>{formatDateTime(user.createdAt)}</dd>
            <dt className="muted-copy">Last sign-in</dt><dd style={{ margin: 0 }}>{formatDateTime(user.lastSignInAt)}</dd>
            <dt className="muted-copy">Status</dt><dd style={{ margin: 0 }}>{user.suspended ? <span className="admin-badge admin-badge--bad">Suspended</span> : <span className="admin-badge admin-badge--ok">Active</span>}</dd>
          </dl>
          <p className="admin-stat-sub" style={{ marginTop: "1rem" }}>
            Accounts cannot be suspended or deleted from this screen.
          </p>
        </section>

        <section className="surface-card" aria-labelledby="roles-heading">
          <h2 id="roles-heading" className="section-title admin-section-title">Roles</h2>
          <p style={{ marginTop: 0, display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {user.allRoles.length === 0
              ? <span className="muted-copy">No roles</span>
              : user.allRoles.map((r) => (<span key={r} className="admin-badge admin-badge--warn">{ROLE_LABEL[r] ?? r}</span>))}
          </p>
          {canManageRoles ? (
            <RoleControls userId={user.id} roles={user.allRoles} />
          ) : (
            <p className="muted-copy" role="status" style={{ fontSize: "0.92rem" }}>
              {isSelf
                ? "You cannot change your own roles."
                : isOwner
                  ? "An owner account's roles cannot be changed here."
                  : "Only the owner can change roles."}
            </p>
          )}
        </section>

        <section className="surface-card" aria-labelledby="access-heading">
          <h2 id="access-heading" className="section-title admin-section-title">Learning access</h2>
          {user.entitlements.length === 0 ? (
            <EmptyState title="No access records" description="Access is created automatically when a purchase is paid." />
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Scope</th>
                    <th scope="col">Status</th>
                    <th scope="col">Starts</th>
                    <th scope="col">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {user.entitlements.map((e) => (
                    <tr key={e.id}>
                      <td>{e.scope === "platform" ? "Whole platform" : (e.courseTitle ?? "Course")}</td>
                      <td>
                        <StatusBadge status={e.status === "revoked" ? "archived" : e.current ? "published" : "draft"} />
                        <span className="admin-stat-sub"> {e.status === "revoked" ? "Revoked" : e.current ? "Active" : "Not active"}</span>
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(e.startsAt)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{e.expiresAt ? formatDateTime(e.expiresAt) : "Never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="admin-stat-sub" style={{ marginTop: "0.8rem" }}>
            Access is read-only here. It is managed by the payment and refund system.
          </p>
        </section>

        <Link href="/admin/users" className="text-link">← Back to all users</Link>
      </div>
    </>
  );
}