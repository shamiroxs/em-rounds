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

type LectureListRow = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  media_asset_id: string | null;
  topics: {
    id: string;
    title: string;
    subjects: { title: string; courses: { title: string } | null } | null;
  } | null;
};

export default async function LecturesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { status, q } = await searchParams;
  const filter = isContentStatus(status) ? status : "all";
  const search = (q ?? "").trim().slice(0, 100);

  let query = staff.supabase
    .from("lectures")
    .select("id, title, status, updated_at, media_asset_id, topics(id, title, subjects(title, courses(title)))")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (filter !== "all") query = query.eq("status", filter);
  if (search) query = query.ilike("title", `%${search.replace(/[%_\\]/g, "\\$&")}%`);
  const { data, error } = await query;
  const lectures = (data ?? []) as unknown as LectureListRow[];

  // Which lectures have a playable video?
  const playable = new Set<string>();
  const mediaIds = lectures.map((l) => l.media_asset_id).filter((id): id is string => !!id);
  if (mediaIds.length > 0) {
    const { data: media } = await staff.supabase
      .from("media_assets")
      .select("id, metadata")
      .in("id", mediaIds);
    for (const m of (media ?? []) as unknown as { id: string; metadata: { playback_id?: unknown } | null }[]) {
      if (typeof m.metadata?.playback_id === "string" && m.metadata.playback_id) playable.add(m.id);
    }
  }

  return (
    <>
      <PageHeader
        title="Lectures"
        description="Every lecture across all courses. Open a lecture to manage its video, objectives and resources."
        actions={
          <Link href="/admin/lectures/new" className="primary-button">
            <Plus size={18} aria-hidden style={{ marginRight: "0.4rem" }} /> New lecture
          </Link>
        }
      />

      <form method="get" role="search" style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1rem" }}>
        {filter !== "all" && <input type="hidden" name="status" value={filter} />}
        <label className="sr-only" htmlFor="q" style={{ position: "absolute", left: "-9999px" }}>Search lectures by title</label>
        <input id="q" name="q" className="field-input" style={{ maxWidth: "22rem" }} placeholder="Search by title…" defaultValue={search} />
        <button type="submit" className="secondary-button">Search</button>
      </form>

      <nav aria-label="Filter lectures by status" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        {FILTERS.map((f) => {
          const params = new URLSearchParams();
          if (f.key !== "all") params.set("status", f.key);
          if (search) params.set("q", search);
          const qs = params.toString();
          return (
            <Link
              key={f.key}
              href={qs ? `/admin/lectures?${qs}` : "/admin/lectures"}
              className="admin-nav-link"
              aria-current={filter === f.key ? "page" : undefined}
              style={{ width: "auto" }}
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {error ? (
        <div className="error-box" role="alert">Lectures could not be loaded. Refresh the page to try again.</div>
      ) : lectures.length === 0 ? (
        <EmptyState
          title={search || filter !== "all" ? "No lectures match" : "No lectures yet"}
          description={search || filter !== "all" ? "Try a different search or filter." : "Create your first lecture, or add one from a topic page."}
          action={!search && filter === "all" ? <Link href="/admin/lectures/new" className="primary-button">Create a lecture</Link> : undefined}
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Lecture</th>
                <th scope="col">Location</th>
                <th scope="col">Status</th>
                <th scope="col">Video</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {lectures.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/admin/lectures/${l.id}`} className="text-link">{l.title}</Link></td>
                  <td className="muted-copy" style={{ fontSize: "0.85rem" }}>
                    {l.topics ? (
                      <Link href={`/admin/topics/${l.topics.id}`} className="text-link">
                        {l.topics.subjects?.courses?.title ?? "Course"} › {l.topics.subjects?.title ?? "Subject"} › {l.topics.title}
                      </Link>
                    ) : "—"}
                  </td>
                  <td><StatusBadge status={l.status} /></td>
                  <td>{l.media_asset_id && playable.has(l.media_asset_id) ? <StatusBadge status="ready" /> : <span className="muted-copy">None</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(l.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lectures.length === 100 && (
        <p className="admin-stat-sub" style={{ marginTop: "0.6rem" }}>Showing the 100 most recently updated lectures. Use search to narrow the list.</p>
      )}
    </>
  );
}