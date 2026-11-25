import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="muted-copy admin-page-desc">{description}</p>}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty" role="status">
      <p className="admin-empty-title">{title}</p>
      {description && <p className="muted-copy">{description}</p>}
      {action}
    </div>
  );
}

const BADGE_CLASS: Record<string, string> = {
  published: "admin-badge admin-badge--ok",
  ready: "admin-badge admin-badge--ok",
  draft: "admin-badge",
  archived: "admin-badge admin-badge--muted",
  retired: "admin-badge admin-badge--muted",
  processing: "admin-badge admin-badge--warn",
  waiting: "admin-badge admin-badge--warn",
  error: "admin-badge admin-badge--bad",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={BADGE_CLASS[status] ?? "admin-badge"}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function AdminSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="skeleton" style={{ height: "2rem", width: "40%" }} />
      <div className="skeleton" style={{ height: "1rem", width: "60%", marginTop: "0.75rem" }} />
      <div className="admin-stat-grid" style={{ marginTop: "1.5rem" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton" style={{ height: "6rem" }} />
        ))}
      </div>
    </div>
  );
}
