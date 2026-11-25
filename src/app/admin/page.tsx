import { requireStaff, ROLE_LABEL } from "@/lib/admin/access";
import { PageHeader } from "@/components/admin/ui";

export const instant = false;

export default async function AdminHomePage() {
  // Every page checks access itself; the layout alone is not enough.
  const staff = await requireStaff();

  return (
    <>
      <PageHeader
        title="Administration"
        description={`Signed in as ${ROLE_LABEL[staff.role]}. Content tools will appear in the sidebar as each module is added.`}
      />
      <div className="admin-empty" role="status">
        <p className="admin-empty-title">The administration shell is ready.</p>
        <p className="muted-copy">
          Dashboard statistics and content management are added in the next milestones.
        </p>
      </div>
    </>
  );
}
