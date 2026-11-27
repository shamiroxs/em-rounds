import Link from "next/link";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { EmptyState, PageHeader } from "@/components/admin/ui";

export const instant = false;

const PAGE_SIZE = 50;
const ENTITY_TYPES = ["course", "subject", "topic", "lecture", "question", "question_tag", "announcement", "user"] as const;
const ENTITY_PATH: Record<string, string> = {
  course: "/admin/courses/",
  subject: "/admin/subjects/",
  topic: "/admin/topics/",
  lecture: "/admin/lectures/",
  question: "/admin/questions/",
  announcement: "/admin/announcements/",
  user: "/admin/users/",
};

type Row = {
  id: number;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: unknown;
  created_at: string;
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; q?: string; page?: string }>;
}) {
  const staff = await requireCapability("audit.view");
  const { entity, q, page } = await searchParams;
  const entityFilter = (ENTITY_TYPES as readonly string[]).includes(entity ?? "") ? (entity as string) : "";
  const search = (q ?? "").trim().slice(0, 60);
  const pageNumber = Math.max(1, Number.parseInt(page ?? "1", 10) || 1);
  const from = (pageNumber - 1) * PAGE_SIZE;

  let query = staff.supabase
    .from("admin_audit_logs")
    .select("id, actor_user_id, action, entity_type, entity_id, details, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);
  if (entityFilter) query = query.eq("entity_type", entityFilter);
  if (search) query = query.ilike("action", `%${search.replace(/[%_\\]/g, "\\$&")}%`);
  const { data, error, count } = await query;
  const rows = (data ?? []) as unknown as Row[];

  // Names of the acting administrators on this page.
  const names = new Map<string, string>();
  const actorIds = [...new Set(rows.map((r) => r.actor_user_id).filter((id): id is string => !!id))];
  if (actorIds.length > 0) {
    const { data: profiles } = await staff.supabase.from("profiles").select("id, display_name").in("id", actorIds);
    for (const p of (profiles ?? []) as unknown as { id: string; display_name: string | null }[]) {
      if (p.display_name) names.set(p.id, p.display_name);
    }
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  function href(p: number) {
    const params = new URLSearchParams();
    if (entityFilter) params.set("entity", entityFilter);
    if (search) params.set("q", search);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/admin/audit-log?${qs}` : "/admin/audit-log";
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="A permanent record of administrative actions. Entries cannot be edited or deleted. Passwords, keys and answer keys are never recorded."
      />

      <form method="get" role="search" style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1rem" }}>
        <label htmlFor="entity" style={{ position: "absolute", left: "-9999px" }}>Filter by record type</label>
        <select id="entity" name="entity" className="field-input" style={{ maxWidth: "14rem" }} defaultValue={entityFilter}>
          <option value="">All record types</option>
          {ENTITY_TYPES.map((t) => (<option key={t} value={t}>{t.replace("_", " ")}</option>))}
        </select>
        <label htmlFor="q" style={{ position: "absolute", left: "-9999px" }}>Search actions</label>
        <input id="q" name="q" className="field-input" style={{ maxWidth: "16rem" }} placeholder="Action contains… (e.g. publish)" defaultValue={search} />
        <button type="submit" className="secondary-button">Filter</button>
      </form>

      {error ? (
        <div className="error-box" role="alert">The audit log could not be loaded. Refresh the page to try again.</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No entries" description={entityFilter || search ? "No entries match this filter." : "Administrative actions will be listed here."} />
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">Action</th>
                  <th scope="col">Record</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const base = ENTITY_PATH[r.entity_type];
                  const hasDetails = r.details && typeof r.details === "object" && Object.keys(r.details as object).length > 0;
                  return (
                    <tr key={r.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.created_at)}</td>
                      <td>{r.actor_user_id ? (names.get(r.actor_user_id) ?? "Administrator") : "System or removed account"}</td>
                      <td><code>{r.action}</code></td>
                      <td>
                        {r.entity_type.replace("_", " ")}
                        {r.entity_id && base ? (
                          <> · <Link href={`${base}${r.entity_id}`} className="text-link">{r.entity_id.slice(0, 8)}</Link></>
                        ) : r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
                      </td>
                      <td style={{ minWidth: "10rem" }}>
                        {hasDetails ? (
                          <details>
                            <summary style={{ cursor: "pointer" }}>View</summary>
                            <pre style={{ margin: "0.4rem 0 0", maxWidth: "26rem", overflowX: "auto", fontSize: "0.78rem", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                              {JSON.stringify(r.details, null, 2)}
                            </pre>
                          </details>
                        ) : (<span className="muted-copy">—</span>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.8rem", marginTop: "1rem" }}>
            <span className="admin-stat-sub">{total.toLocaleString("en-IN")} entr{total === 1 ? "y" : "ies"} · page {pageNumber} of {totalPages}</span>
            {pageNumber > 1 && <Link href={href(pageNumber - 1)} className="secondary-button">Newer</Link>}
            {pageNumber < totalPages && <Link href={href(pageNumber + 1)} className="secondary-button">Older</Link>}
          </div>
        </>
      )}
    </>
  );
}