import { Megaphone } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDateTime } from "@/lib/admin/format";

type Row = {
  id: string;
  title: string;
  body: string;
  publish_at: string | null;
  created_at: string;
};

const SHOW = 3;

export async function AnnouncementsPanel({ supabase }: { supabase: SupabaseClient }) {
  const nowIso = new Date().toISOString();
  // Filtered in the query as well as by the database rules, so drafts never
  // show up here, even for an administrator who is browsing the student area.
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, publish_at, created_at")
    .eq("status", "published")
    .or(`publish_at.is.null,publish_at.lte.${nowIso}`)
    .order("created_at", { ascending: false })
    .limit(10);

  // An announcement problem must never break the Learn page.
  if (error || !data || data.length === 0) return null;

  const items = (data as unknown as Row[])
    .map((a) => ({ ...a, shownAt: a.publish_at ?? a.created_at }))
    .sort((a, b) => b.shownAt.localeCompare(a.shownAt))
    .slice(0, SHOW);

  return (
    <section aria-labelledby="announcements-heading" style={{ margin: "1.25rem 0" }}>
      <h2
        id="announcements-heading"
        className="section-title"
        style={{ fontSize: "1.05rem", display: "flex", alignItems: "center", gap: "0.5rem" }}
      >
        <Megaphone size={18} aria-hidden /> Announcements
      </h2>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {items.map((a) => (
          <article key={a.id} className="surface-card" style={{ margin: 0 }}>
            <strong>{a.title}</strong>
            <div className="muted-copy" style={{ fontSize: "0.8rem" }}>{formatDateTime(a.shownAt)}</div>
            {a.body.length > 280 ? (
              <details style={{ marginTop: "0.4rem" }}>
                <summary style={{ cursor: "pointer" }}>Read more</summary>
                <p className="muted-copy" style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{a.body}</p>
              </details>
            ) : (
              <p className="muted-copy" style={{ whiteSpace: "pre-wrap", margin: "0.4rem 0 0" }}>{a.body}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}