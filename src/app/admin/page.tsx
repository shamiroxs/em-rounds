import { Suspense } from "react";
import { requireStaff, ROLE_LABEL } from "@/lib/admin/access";
import { PageHeader } from "@/components/admin/ui";
import {
  DashboardStatsSection,
  RecentActivitySection,
} from "@/components/admin/dashboard-sections";

import Link from "next/link";

export const instant = false;

function StatsSkeleton() {
  return (
    <div className="admin-stat-grid" aria-busy="true" aria-label="Loading statistics">
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="skeleton" style={{ height: "6.5rem" }} />
      ))}
    </div>
  );
}

function ActivitySkeleton() {
  return <div className="skeleton" style={{ height: "10rem" }} aria-busy="true" aria-label="Loading activity" />;
}

export default async function AdminHomePage() {
  // Every page checks access itself; the layout alone is not enough.
  const staff = await requireStaff();

  // Content editors do not get platform statistics or activity logs.
  if (!staff.can("dashboard.view")) {
    return (
      <>
        <PageHeader
          title="Content workspace"
          description={`Signed in as ${ROLE_LABEL[staff.role]}. You can prepare draft content. An administrator publishes it.`}
        />
        <div className="admin-empty" role="status">
          <p className="admin-empty-title">Your content tools appear in the sidebar.</p>
          <p className="muted-copy">Courses, lectures and questions are added module by module.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Overview"
        description="Live figures from your platform database."
      />
      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStatsSection supabase={staff.supabase} />
      </Suspense>

      <section className="admin-section" aria-labelledby="recent-activity">
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.6rem", marginBottom: "0.8rem" }}>
            <h2 id="recent-activity" className="section-title admin-section-title" style={{ margin: 0 }}>
              Recent administrative activity
            </h2>
            <Link href="/admin/audit-log" className="text-link">View full audit log →</Link>
        </div>
        <Suspense fallback={<ActivitySkeleton />}>
          <RecentActivitySection supabase={staff.supabase} />
        </Suspense>
      </section>
    </>
  );
}
