import { requireCapability } from "@/lib/admin/access";
import { Breadcrumbs } from "@/components/admin/breadcrumbs";
import { PageHeader } from "@/components/admin/ui";
import { AnnouncementForm } from "@/components/admin/announcements/announcement-form";

export const instant = false;

export default async function NewAnnouncementPage() {
  await requireCapability("announcements.manage");
  return (
    <>
      <Breadcrumbs items={[{ label: "Announcements", href: "/admin/announcements" }, { label: "New announcement" }]} />
      <PageHeader title="New announcement" description="Saved as a draft. Publish it from the next screen." />
      <div className="surface-card" style={{ maxWidth: "42rem" }}>
        <AnnouncementForm mode="create" />
      </div>
    </>
  );
}