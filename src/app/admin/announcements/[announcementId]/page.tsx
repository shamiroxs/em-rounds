import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCapability } from "@/lib/admin/access";
import { formatDateTime } from "@/lib/admin/format";
import { isoToIstInput } from "@/lib/admin/datetime";
import { UUID_RE } from "@/lib/learning";
import type { ContentStatus } from "@/lib/admin/validation";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { AnnouncementForm } from "@/components/admin/announcements/announcement-form";
import { AnnouncementStatusControls } from "@/components/admin/announcements/announcement-status-controls";
import { DeleteAnnouncementButton } from "@/components/admin/announcements/delete-announcement-button";

export const instant = false;

export default async function AnnouncementDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ announcementId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const staff = await requireCapability("announcements.manage");
  const { announcementId } = await params;
  const { created } = await searchParams;
  if (!UUID_RE.test(announcementId)) notFound();

  const { data, error } = await staff.supabase
    .from("announcements")
    .select("id, title, body, status, publish_at, created_at, updated_at")
    .eq("id", announcementId)
    .maybeSingle();
  if (error) {
    return <div className="error-box" role="alert">This announcement could not be loaded. Refresh the page to try again.</div>;
  }
  if (!data) notFound();
  const a = data as unknown as {
    id: string; title: string; body: string; status: ContentStatus;
    publish_at: string | null; created_at: string; updated_at: string;
  };
  const scheduled = a.status === "published" && a.publish_at && new Date(a.publish_at).getTime() > Date.now();

  return (
    <>
      <Breadcrumbs items={[{ label: "Announcements", href: "/admin/announcements" }, { label: a.title }]} />
      <PageHeader title={a.title} actions={<StatusBadge status={a.status} />} />

      {created === "1" && (
        <div className="success-box" role="status" style={{ marginBottom: "1rem" }}>Draft announcement created.</div>
      )}
      {scheduled && (
        <div className="error-box" role="status" style={{ marginBottom: "1rem" }}>
          Published, but scheduled: students see it from {formatDateTime(a.publish_at)}.
        </div>
      )}

      <div className="admin-form-grid" style={{ maxWidth: "46rem" }}>
        <section className="surface-card" aria-labelledby="details-heading">
          <h2 id="details-heading" className="section-title admin-section-title">Details</h2>
          <AnnouncementForm
            mode="edit"
            announcementId={a.id}
            initial={{ title: a.title, body: a.body, publishAt: isoToIstInput(a.publish_at) }}
          />
          <p className="admin-stat-sub" style={{ marginTop: "1rem" }}>
            Created {formatDateTime(a.created_at)} · Updated {formatDateTime(a.updated_at)}
            {a.publish_at ? ` · Publish time ${formatDateTime(a.publish_at)}` : ""}
          </p>
        </section>

        <section className="surface-card" aria-labelledby="status-heading">
          <h2 id="status-heading" className="section-title admin-section-title">Publication</h2>
          <AnnouncementStatusControls id={a.id} status={a.status} />
        </section>

        {a.status !== "published" && (
          <section className="surface-card" aria-labelledby="danger-heading">
            <h2 id="danger-heading" className="section-title admin-section-title">Delete</h2>
            <p className="muted-copy" style={{ marginBottom: "1rem", fontSize: "0.92rem" }}>
              Deleting is permanent. To hide an announcement but keep it, archive it instead.
            </p>
            <DeleteAnnouncementButton id={a.id} title={a.title} />
          </section>
        )}

        <Link href="/admin/announcements" className="text-link">← Back to all announcements</Link>
      </div>
    </>
  );
}