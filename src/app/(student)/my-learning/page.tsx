import Link from "next/link";
import { Bookmark, CheckCircle2, Clock, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/auth";

type ProgressRow = {
  progress_seconds: number;
  completed_at: string | null;
  updated_at: string;
  lectures: { id: string; title: string; topics: { title: string } } | null;
};
type BookmarkRow = {
  created_at: string;
  lectures: { id: string; title: string; topics: { title: string } } | null;
};

function LectureLink({
  id, title, topic,
}: { id: string; title: string; topic: string }) {
  return (
    <Link href={`/learn/lectures/${id}`} className="lecture-row">
      <span style={{ flex: 1 }}>
        <span className="lecture-title">{title}</span>
        <span className="muted-copy" style={{ display: "block", fontSize: "0.8rem" }}>{topic}</span>
      </span>
    </Link>
  );
}

function Section({
  title, icon, empty, children, isEmpty,
}: {
  title: string; icon: React.ReactNode; empty: string;
  children: React.ReactNode; isEmpty: boolean;
}) {
  return (
    <section className="surface-card" style={{ marginTop: "1rem" }}>
      <h2 className="section-title" style={{ fontSize: "1.1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        {icon} {title}
      </h2>
      <div style={{ marginTop: "0.5rem" }}>
        {isEmpty ? <p className="muted-copy">{empty}</p> : children}
      </div>
    </section>
  );
}

export default async function MyLearningPage() {
  const { supabase } = await requireUser();

  // RLS limits both queries to the signed-in student's own rows. Lectures the
  // student can no longer access are returned as null and skipped below.
  const [progressRes, bookmarkRes] = await Promise.all([
    supabase
      .from("lecture_progress")
      .select("progress_seconds, completed_at, updated_at, lectures ( id, title, topics ( title ) )")
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("lecture_bookmarks")
      .select("created_at, lectures ( id, title, topics ( title ) )")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (progressRes.error || bookmarkRes.error) {
    throw new Error("Could not load your learning data.");
  }

  const progress = ((progressRes.data ?? []) as unknown as ProgressRow[]).filter((p) => p.lectures);
  const bookmarks = ((bookmarkRes.data ?? []) as unknown as BookmarkRow[]).filter((b) => b.lectures);

  const inProgress = progress.filter((p) => !p.completed_at);
  const completed = progress.filter((p) => p.completed_at);
  const recent = progress.slice(0, 5);

  return (
    <>
      <h1 className="page-title">My Learning</h1>
      <p className="muted-copy">
        {completed.length} completed · {inProgress.length} in progress
      </p>

      <Section title="Continue learning" icon={<PlayCircle size={20} aria-hidden />}
        isEmpty={inProgress.length === 0}
        empty="Nothing in progress. Start a lecture from the Learn tab.">
        {inProgress.map((p) => (
          <LectureLink key={p.lectures!.id} id={p.lectures!.id}
            title={p.lectures!.title} topic={p.lectures!.topics.title} />
        ))}
      </Section>

      <Section title="Recently accessed" icon={<Clock size={20} aria-hidden />}
        isEmpty={recent.length === 0}
        empty="Lectures you watch will appear here.">
        {recent.map((p) => (
          <LectureLink key={p.lectures!.id} id={p.lectures!.id}
            title={p.lectures!.title} topic={p.lectures!.topics.title} />
        ))}
      </Section>

      <Section title="Bookmarked" icon={<Bookmark size={20} aria-hidden />}
        isEmpty={bookmarks.length === 0}
        empty="Bookmark a lecture to find it quickly later.">
        {bookmarks.map((b) => (
          <LectureLink key={b.lectures!.id} id={b.lectures!.id}
            title={b.lectures!.title} topic={b.lectures!.topics.title} />
        ))}
      </Section>

      <Section title="Completed" icon={<CheckCircle2 size={20} aria-hidden />}
        isEmpty={completed.length === 0}
        empty="Completed lectures will appear here.">
        {completed.map((p) => (
          <LectureLink key={p.lectures!.id} id={p.lectures!.id}
            title={p.lectures!.title} topic={p.lectures!.topics.title} />
        ))}
      </Section>
    </>
  );
}