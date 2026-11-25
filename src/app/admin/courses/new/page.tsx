import { requireCapability } from "@/lib/admin/access";
import { PageHeader } from "@/components/admin/ui";
import { CourseForm } from "@/components/admin/courses/course-form";

export const instant = false;

export default async function NewCoursePage() {
  await requireCapability("content.edit");
  return (
    <>
      <PageHeader
        title="New course"
        description="The course is saved as a draft. Add subjects and lectures, then ask an administrator to publish it."
      />
      <div className="surface-card" style={{ maxWidth: "42rem" }}>
        <CourseForm mode="create" />
      </div>
    </>
  );
}
