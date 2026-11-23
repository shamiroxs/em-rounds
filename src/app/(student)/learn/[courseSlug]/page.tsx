import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, Circle, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { bySort, type Subject } from "@/lib/learning";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const { supabase } = await requireUser();

  const { data: course } = await supabase
    .from("courses")
    .select(
      `id, title, description,
       subjects ( id, title, description, sort_order, status,
         topics ( id, title, description, sort_order, status,
           lectures ( id, title, description, sort_order, status ) ) )`,
    )
    .eq("slug", courseSlug)
    .eq("status", "published")
    .maybeSingle();

  if (!course) notFound();

  const subjects = ((course.subjects ?? []) as unknown as Subject[])
    .sort(bySort)
    .map((s) => ({
      ...s,
      topics: (s.topics ?? []).sort(bySort).map((t) => ({
        ...t,
        lectures: (t.lectures ?? []).sort(bySort),
      })),
    }));

  const lectureIds = subjects.flatMap((s) =>
    s.topics.flatMap((t) => t.lectures.map((l) => l.id)),
  );

  const completed = new Set<string>();
  if (lectureIds.length > 0) {
    const { data: progress } = await supabase
      .from("lecture_progress")
      .select("lecture_id, completed_at")
      .in("lecture_id", lectureIds)
      .not("completed_at", "is", null);
    progress?.forEach((p) => completed.add(p.lecture_id));
  }

  const total = lectureIds.length;

  return (
    <>
      <Link href="/learn" className="text-link breadcrumb">
        <ChevronLeft size={16} aria-hidden /> All courses
      </Link>
      <h1 className="page-title" style={{ marginTop: "0.75rem" }}>
        {course.title}
      </h1>
      {course.description && (
        <p className="prose-text muted-copy">{course.description}</p>
      )}

      {total > 0 && (
        <div style={{ margin: "1rem 0", maxWidth: "24rem" }}>
          <p className="muted-copy" style={{ fontSize: "0.85rem" }}>
            {completed.size} of {total} lectures completed
          </p>
          <div className="progress-track" role="progressbar"
            aria-valuemin={0} aria-valuemax={total} aria-valuenow={completed.size}>
            <div className="progress-fill"
              style={{ width: `${(completed.size / total) * 100}%` }} />
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="empty-state" style={{ marginTop: "1.25rem" }}>
          <Lock size={32} aria-hidden />
          <h2 className="section-title">No lectures available to you yet</h2>
          <p>
            Lectures may still be in preparation, or this course may require
            access that is not active on your account.
          </p>
        </div>
      )}

      {subjects.map((subject) => (
        <section key={subject.id} style={{ marginTop: "1.75rem" }}>
          <h2 className="section-title" style={{ fontSize: "1.25rem" }}>
            {subject.title}
          </h2>
          {subject.description && (
            <p className="muted-copy" style={{ fontSize: "0.9rem" }}>
              {subject.description}
            </p>
          )}
          {subject.topics.map((topic) => (
            <div key={topic.id} className="surface-card"
              style={{ marginTop: "0.9rem", padding: "1rem" }}>
              <h3 style={{ fontWeight: 700 }}>{topic.title}</h3>
              {topic.lectures.length === 0 ? (
                <p className="muted-copy" style={{ fontSize: "0.85rem" }}>
                  No lectures available in this topic yet.
                </p>
              ) : (
                <div style={{ marginTop: "0.5rem" }}>
                  {topic.lectures.map((l) => (
                    <Link key={l.id} href={`/learn/lectures/${l.id}`} className="lecture-row">
                      {completed.has(l.id) ? (
                        <CheckCircle2 size={20} aria-label="Completed"
                          style={{ color: "var(--success-text)", flexShrink: 0 }} />
                      ) : (
                        <Circle size={20} aria-label="Not completed"
                          style={{ color: "var(--subtle)", flexShrink: 0 }} />
                      )}
                      <span className="lecture-title">{l.title}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      ))}
    </>
  );
}