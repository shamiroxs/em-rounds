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

type Row = {
  id: string;
  question_code: string | null;
  status: string;
  updated_at: string;
  topics: {
    id: string;
    title: string;
    subjects: { title: string; courses: { title: string } | null } | null;
  } | null;
  question_versions: { id: string; version_number: number; stem: string; difficulty: string; status: string }[];
};

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const staff = await requireCapability("content.edit");
  const { status, q } = await searchParams;
  const filter = isContentStatus(status) ? status : "all";
  const search = (q ?? "").trim().slice(0, 100);

  // Search matches question text (any version) or the question code.
  let idFilter: string[] | null = null;
  if (search) {
    const safe = search.replace(/[%_\\]/g, "\\$&");
    const [byStem, byCode] = await Promise.all([
      staff.supabase.from("question_versions").select("question_id").ilike("stem", `%${safe}%`).limit(200),
      staff.supabase.from("questions").select("id").ilike("question_code", `%${safe}%`).limit(200),
    ]);
    idFilter = [
      ...new Set([
        ...((byStem.data ?? []) as unknown as { question_id: string }[]).map((r) => r.question_id),
        ...((byCode.data ?? []) as unknown as { id: string }[]).map((r) => r.id),
      ]),
    ];
  }

  let rows: Row[] = [];
  let failed = false;
  if (!(idFilter && idFilter.length === 0)) {
    let query = staff.supabase
      .from("questions")
      .select(
        "id, question_code, status, updated_at, topics(id, title, subjects(title, courses(title))), question_versions(id, version_number, stem, difficulty, status)",
      )
      .order("updated_at", { ascending: false })
      .limit(100);
    if (filter !== "all") query = query.eq("status", filter);
    if (idFilter) query = query.in("id", idFilter);
    const { data, error } = await query;
    if (error) failed = true;
    rows = (data ?? []) as unknown as Row[];
  }

  return (
    <>
      <PageHeader
        title="Questions"
        description="Single-best-answer questions. Answers and explanations are visible to staff only."
        actions={
          <Link href="/admin/questions/new" className="primary-button">
            <Plus size={18} aria-hidden style={{ marginRight: "0.4rem" }} /> New question
          </Link>
        }
      />

      <form method="get" role="search" style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", marginBottom: "1rem" }}>
        {filter !== "all" && <input type="hidden" name="status" value={filter} />}
        <label htmlFor="q" style={{ position: "absolute", left: "-9999px" }}>Search questions</label>
        <input id="q" name="q" className="field-input" style={{ maxWidth: "22rem" }} placeholder="Search question text or code…" defaultValue={search} />
        <button type="submit" className="secondary-button">Search</button>
      </form>

      <nav aria-label="Filter questions by status" style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
        {FILTERS.map((f) => {
          const params = new URLSearchParams();
          if (f.key !== "all") params.set("status", f.key);
          if (search) params.set("q", search);
          const qs = params.toString();
          return (
            <Link key={f.key} href={qs ? `/admin/questions?${qs}` : "/admin/questions"} className="admin-nav-link"
              aria-current={filter === f.key ? "page" : undefined} style={{ width: "auto" }}>
              {f.label}
            </Link>
          );
        })}
      </nav>

      {failed ? (
        <div className="error-box" role="alert">Questions could not be loaded. Refresh the page to try again.</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title={search || filter !== "all" ? "No questions match" : "No questions yet"}
          description={search || filter !== "all" ? "Try a different search or filter." : "Create the first question for the question bank."}
          action={!search && filter === "all" ? <Link href="/admin/questions/new" className="primary-button">Create a question</Link> : undefined}
        />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Topic</th>
                <th scope="col">Status</th>
                <th scope="col">Difficulty</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const latest = [...(r.question_versions ?? [])].sort((a, b) => b.version_number - a.version_number)[0];
                const snippet = latest ? (latest.stem.length > 110 ? latest.stem.slice(0, 110) + "…" : latest.stem) : "(no content)";
                return (
                  <tr key={r.id}>
                    <td style={{ minWidth: "16rem" }}>
                      <Link href={`/admin/questions/${r.id}`} className="text-link">{snippet}</Link>
                      <div className="admin-stat-sub">
                        {r.question_code ? `${r.question_code} · ` : ""}{latest ? `v${latest.version_number} ${latest.status}` : ""}
                      </div>
                    </td>
                    <td className="muted-copy" style={{ fontSize: "0.85rem" }}>{r.topics?.title ?? "—"}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td style={{ textTransform: "capitalize" }}>{latest?.difficulty ?? "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 100 && (
        <p className="admin-stat-sub" style={{ marginTop: "0.6rem" }}>Showing the 100 most recently updated questions. Use search to narrow the list.</p>
      )}
    </>
  );
}