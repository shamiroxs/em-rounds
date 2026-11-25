import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDashboardStats, loadRecentActivity, type Stat } from "@/lib/admin/stats";
import { formatDateTime } from "@/lib/admin/format";
import { EmptyState } from "@/components/admin/ui";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: Stat;
  sub?: string;
}) {
  return (
    <div className="admin-stat">
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value">
        {value === null ? "—" : value.toLocaleString("en-IN")}
      </p>
      <p className="admin-stat-sub">
        {value === null ? "Could not be loaded" : sub}
      </p>
    </div>
  );
}

export async function DashboardStatsSection({ supabase }: { supabase: SupabaseClient }) {
  const s = await loadDashboardStats(supabase);
  const failed = Object.values(s).some((v) => v === null);

  return (
    <>
      {failed && (
        <div className="error-box" role="alert" style={{ marginBottom: "1rem" }}>
          Some figures could not be loaded and are shown as “—”. Refresh the page to try again.
        </div>
      )}
      <div className="admin-stat-grid">
        <StatCard label="Courses" value={s.courses} />
        <StatCard label="Published courses" value={s.publishedCourses} />
        <StatCard label="Subjects" value={s.subjects} />
        <StatCard label="Topics" value={s.topics} />
        <StatCard label="Lectures" value={s.lectures} />
        <StatCard label="Published lectures" value={s.publishedLectures} />
        <StatCard
          label="Registered students"
          value={s.students}
          sub={s.staffAccounts === null ? undefined : `Excludes ${s.staffAccounts.toLocaleString("en-IN")} staff account${s.staffAccounts === 1 ? "" : "s"}`}
        />
      </div>
    </>
  );
}

export async function RecentActivitySection({ supabase }: { supabase: SupabaseClient }) {
  const { rows, failed } = await loadRecentActivity(supabase);

  if (failed) {
    return (
      <div className="error-box" role="alert">
        Recent activity could not be loaded. Refresh the page to try again.
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No administrative activity yet"
        description="Changes made in the administration area will be listed here."
      />
    );
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">When</th>
            <th scope="col">Who</th>
            <th scope="col">Action</th>
            <th scope="col">Record</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td style={{ whiteSpace: "nowrap" }}>{formatDateTime(r.created_at)}</td>
              <td>{r.actor}</td>
              <td><code>{r.action}</code></td>
              <td>
                {r.entity_type}
                {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
