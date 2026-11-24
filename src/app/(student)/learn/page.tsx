import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireUser } from "@/lib/auth";

export default async function LearnPage() {
  const { supabase } = await requireUser();
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id, slug, title, description")
    .eq("status", "published")
    .order("sort_order")
    .order("title");

  const accessList = await Promise.all(
    (courses ?? []).map((c) =>
      supabase.rpc("can_read_course", { target_course_id: c.id }),
    ),
  );
  const unlocked = new Set(
    (courses ?? []).filter((_, i) => accessList[i].data === true).map((c) => c.id),
  );

  if (error) throw new Error("Could not load courses.");

  return (
    <>
      <h1 className="page-title">Learn</h1>
      <p className="muted-copy">Choose a course to begin.</p>

      {!courses || courses.length === 0 ? (
        <div className="empty-state" style={{ marginTop: "1.25rem" }}>
          <BookOpen size={32} aria-hidden />
          <h2 className="section-title">No courses available yet</h2>
          <p>New courses will appear here when they are published.</p>
        </div>
      ) : (
        <div className="card-grid">
          {courses.map((c) => (
            <Link key={c.id} href={`/learn/${c.slug}`} className="course-card">
              <div className="course-cover" aria-hidden>
                {c.title.charAt(0).toUpperCase()}
              </div>
              <h2 className="section-title" style={{ fontSize: "1.1rem" }}>
                {c.title}
              </h2>
              {c.description && (
                <p className="muted-copy" style={{ fontSize: "0.9rem" }}>
                  {c.description.length > 140
                    ? c.description.slice(0, 140) + "…"
                    : c.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}