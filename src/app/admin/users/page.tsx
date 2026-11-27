import Link from "next/link";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { loadUserDirectory, DIRECTORY_CAP, type UserSummary } from "@/lib/admin/users-data";
import { EmptyState, PageHeader } from "@/components/admin/ui";

export const instant = false;

const PAGE_SIZE = 25;
const ROLE_LABEL: Record<string, string> = { owner_admin: "Owner", admin: "Admin", content_editor: "Editor" };

function accessLabel(u: UserSummary) {
  if (u.platformAccess) return "Platform";
  if (u.courseAccessCount > 0) return `${u.courseAccessCount} course${u.courseAccessCount === 1 ? "" : "s"}`;
  return "None";
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; page?: string }>;
}) {
  const staff = await requireCapability("users.view");
  const { q, view, page } = await searchParams;
  const search = (q ?? "").trim().toLowerCase().slice(0, 100);
  const staffOnly = view === "staff";
  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);

  let users: UserSummary[] = [];
  let capped = false;
  let failed = false;
  try {
    const result = await loadUserDirectory(staff);
    users = result.users;
    capped = result.capped;
  } catch {
    failed = true;
  }

  const filtered = users
    .filter((u) => (staffOnly ? u.roles.length > 0 : true))
    .filter((u) =>
      !search
        ? true
        : (u.email ?? "").toLowerCase().includes(search) ||
          (u.displayName ?? "").toLowerCase().includes(search) ||
          u.id.toLowerCase().startsWith(search),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(pageNumber, totalPages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function href(p: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (staffOnly) params.set("view", "staff");
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/users?${qs}` : "/admin/users";
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Registered accounts and their access. Email addresses are visible to administrators only."
      />

      <form method="get" role="search" style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1rem" }}>
        {staffOnly && <input type="hidden" name="view" value="staff" />}
        <label htmlFor="q" style={{ position: "absolute", left: "-9999px" }}>Search users</label>
        <input id="q" name="q" className="field-input" style={{ maxWidth: "22rem" }} placeholder="Search name, email or ID…" defaultValue={q ?? ""} />
        <button type="submit" className="secondary-button">Search</button>
      </form>

      <nav aria-label="Filter users" style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem" }}>
        <Link href={search ? `/admin/users?q=${encodeURIComponent(search)}` : "/admin/users"} className="admin-nav-link"
          aria-current={!staffOnly ? "page" : undefined} style={{ width: "auto" }}>All accounts</Link>
        <Link href={search ? `/admin/users?view=staff&q=${encodeURIComponent(search)}` : "/admin/users?view=staff"} className="admin-nav-link"
          aria-current={staffOnly ? "page" : undefined} style={{ width: "auto" }}>Staff only</Link>
      </nav>

      {failed ? (
        <div className="error-box" role="alert">Users could not be loaded. Refresh the page to try again.</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No users match" description={search ? "Try a different search." : "No accounts yet."} />
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Roles</th>
                  <th scope="col">Access</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/users/${u.id}`} className="text-link">{u.displayName ?? u.email ?? "Unnamed"}</Link>
                      {u.displayName && u.email && <div className="admin-stat-sub">{u.email}</div>}
                    </td>
                    <td>
                      {u.roles.length === 0 ? (
                        <span className="muted-copy">Student</span>
                      ) : (
                        <span style={{ display: "inline-flex", gap: "0.3rem", flexWrap: "wrap" }}>
                          {u.roles.map((r) => (<span key={r} className="admin-badge admin-badge--warn">{ROLE_LABEL[r] ?? r}</span>))}
                        </span>
                      )}
                    </td>
                    <td>{accessLabel(u)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(u.createdAt)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(u.lastSignInAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.8rem", marginTop: "1rem" }}>
            <span className="admin-stat-sub">{filtered.length} account{filtered.length === 1 ? "" : "s"} · page {current} of {totalPages}</span>
            {current > 1 && <Link href={href(current - 1)} className="secondary-button">Previous</Link>}
            {current < totalPages && <Link href={href(current + 1)} className="secondary-button">Next</Link>}
          </div>
        </>
      )}
      {capped && (
        <p className="admin-stat-sub" style={{ marginTop: "0.8rem" }}>
          Only the first {DIRECTORY_CAP.toLocaleString("en-IN")} accounts are listed and searched.
        </p>
      )}
    </>
  );
}