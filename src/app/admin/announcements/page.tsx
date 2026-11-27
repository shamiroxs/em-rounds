import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { isContentStatus } from "@/lib/admin/validation";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/ui";

export const instant = false;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
] as const;

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const staff = await requireCapability("announcements.manage");
  const { status } = await searchParams;
  const filter = isContentStatus(status) ? status : "all";

  let query = staff.supabase
    .from("announcements")
    .select("id, title, status, publish_at, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (filter !== "all") query = query.eq("status", filter);
  const { data, error } = await query;
  const rows = (data ?? []) as unknown as {
    id: string; title: string; status: string; publish_at: string | null; created_at: string; updated_at: string;
  }[];
  const now = Date.now();

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Messages for students. Create a draft, then publish it when it is ready."
        actions={
          <Link href="/admin/announcements/new" className="primary-button">
            <Plus size={18} aria-hidden style={{ marginRight: "0.4rem" }} /> New announcement
          </Link>
        }
      />

      <nav aria-label="Filter announcements by status" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        {FILTERS.map((f) => (
          <Link key={f.key} href={f.key === "all" ? "/admin/announcements" : `/admin/announcements?status=${f.key}`}
            className="admin-nav-link" aria-current={filter === f.key ? "page" : undefined} style={{ width: "auto" }}>
            {f.label}
          </Link>
        ))}
      </nav>

      {error ? (
        <div className="error-box" role="alert">Announcements could not be loaded. Refresh the page to try again.</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No announcements yet" : `No ${filter} announcements`}
          description={filter === "all" ? "Create your first announcement." : "Try a different filter."}
          action={filter === "all" ? <Link href="/admin/announcements/new" className="primary-button">Create an announcement</Link> : undefined}
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Announcement</th>
                <th scope="col">Status</th>
                <th scope="col">Publish time</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const scheduled = r.status === "published" && r.publish_at && new Date(r.publish_at).getTime() > now;
                return (
                  <tr key={r.id}>
                    <td><Link href={`/admin/announcements/${r.id}`} className="text-link">{r.title}</Link></td>
                    <td>
                      <StatusBadge status={r.status} />
                      {scheduled && <span className="admin-stat-sub"> Scheduled</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.publish_at)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}