import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, Circle, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bySort } from "@/lib/learning";

type LectureStub = { id: string; title: string; sort_order: number; topic_id: string };
type TopicRow = { id: string; title: string; description: string | null; sort_order: number; status: string };
type SubjectRow = {
  id: string; title: string; description: string | null; sort_order: number; status: string;
  topics: TopicRow[] | null;
};

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseSlug: string }>;
}) {
  const { courseSlug } = await params;
  const { supabase } = await requireUser();

  // Course, subjects and topics: the student's own session (RLS shows published only).
  const { data: course } = await supabase
    .from("courses")
    .select(
      `id, title, description,
       subjects ( id, title, description, sort_order, status,
         topics ( id, title, description, sort_order, status ) )`,
    )
    .eq("slug", courseSlug)
    .eq("status", "published")
    .maybeSingle();

  if (!course) notFound();

  // Access decision comes from the database (platform or course entitlement).
  const { data: access } = await supabase.rpc("can_read_course", {
    target_course_id: course.id,
  });
  const hasAccess = access === true;

  const subjects = ((course.subjects ?? []) as unknown as SubjectRow[])
    .filter((s) => s.status === "published")
    .sort(bySort)
    .map((s) => ({
      ...s,
      topics: (s.topics ?? []).filter((t) => t.status === "published").sort(bySort),
    }));

  const topicIds = subjects.flatMap((s) => s.topics.map((t) => t.id));

  // Lecture TITLES ONLY, read on the server so locked lectures can be listed.
  // Descriptions, objectives, resources and video are never read here.
  const lecturesByTopic = new Map<string, LectureStub[]>();
  if (topicIds.length > 0) {
    const admin = createAdminClient();
    if (!admin) throw new Error("Server is not configured.");
    const { data: lectures } = await admin
      .from("lectures")
      .select("id, title, sort_order, topic_id")
      .in("topic_id", topicIds)
      .eq("status", "published");
    ((lectures ?? []) as LectureStub[]).sort(bySort).forEach((l) => {
      const list = lecturesByTopic.get(l.topic_id) ?? [];
      list.push(l);
      lecturesByTopic.set(l.topic_id, list);
    });
  }

  const allLectureIds = [...lecturesByTopic.values()].flat().map((l) => l.id);
  const completed = new Set<string>();
  if (hasAccess && allLectureIds.length > 0) {
    const { data: progress } = await supabase
      .from("lecture_progress")
      .select("lecture_id")
      .in("lecture_id", allLectureIds)
      .not("completed_at", "is", null);
    progress?.forEach((p) => completed.add(p.lecture_id));
  }

  const total = allLectureIds.length;
  const checkoutHref = `/checkout?next=${encodeURIComponent(`/learn/${courseSlug}`)}`;

  return (
    <>
      <Link href="/learn" className="text-link breadcrumb">
        <ChevronLeft size={16} aria-hidden /> All courses
      </Link>
      <h1 className="page-title" style={{ marginTop: "0.75rem" }}>{course.title}</h1>
      {course.description && <p className="prose-text muted-copy">{course.description}</p>}

      {!hasAccess && (
        <div className="surface-card" style={{ marginTop: "1rem", display: "flex",
          gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
          <Lock size={22} aria-hidden />
          <p style={{ flex: 1, minWidth: "12rem" }}>
            Unlock every lecture with one-time lifetime access.
          </p>
          <Link href={checkoutHref} className="primary-button">Get lifetime access</Link>
        </div>
      )}

      {hasAccess && total > 0 && (
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

      {subjects.length === 0 && (
        <div className="empty-state" style={{ marginTop: "1.25rem" }}>
          <h2 className="section-title">Content coming soon</h2>
          <p>This course has no published subjects yet.</p>
        </div>
      )}

      {subjects.map((subject) => (
        <section key={subject.id} style={{ marginTop: "1.75rem" }}>
          <h2 className="section-title" style={{ fontSize: "1.25rem" }}>{subject.title}</h2>
          {subject.description && (
            <p className="muted-copy" style={{ fontSize: "0.9rem" }}>{subject.description}</p>
          )}
          {subject.topics.map((topic) => {
            const lectures = lecturesByTopic.get(topic.id) ?? [];
            return (
              <div key={topic.id} className="surface-card"
                style={{ marginTop: "0.9rem", padding: "1rem" }}>
                <h3 style={{ fontWeight: 700 }}>{topic.title}</h3>
                {lectures.length === 0 ? (
                  <p className="muted-copy" style={{ fontSize: "0.85rem" }}>
                    No lectures in this topic yet.
                  </p>
                ) : (
                  <div style={{ marginTop: "0.5rem" }}>
                    {lectures.map((l) =>
                      hasAccess ? (
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
                      ) : (
                        <Link key={l.id} href={checkoutHref} className="lecture-row">
                          <Lock size={18} aria-label="Locked"
                            style={{ color: "var(--subtle)", flexShrink: 0 }} />
                          <span className="lecture-title">{l.title}</span>
                          <span className="badge" style={{ marginLeft: "auto" }}>Locked</span>
                        </Link>
                      ),
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </>
  );
}