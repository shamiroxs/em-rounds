import { Clock, ListChecks, PlayCircle, Share2 } from "lucide-react";
import { ShareButton } from "@/components/learning/share-button";

function HomeSection({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  empty?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="surface-card">
      <h2
        className="section-title"
        style={{ fontSize: "1.1rem", display: "flex", gap: "0.5rem", alignItems: "center" }}
      >
        {icon} {title}
      </h2>
      <div style={{ marginTop: "0.6rem" }}>
        {children ?? <p className="muted-copy">{empty}</p>}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <>
      <h1 className="page-title">Welcome back</h1>
      <p className="muted-copy">Take a moment, then pick up where you left off.</p>

      <div className="relief-card" role="img"
        aria-label="A circle slowly expanding and shrinking to guide a calm breath">
        <div className="breathe-circle" aria-hidden />
        <p className="relief-text">Breathe in… and out.</p>
      </div>

      <div className="card-grid">
        <HomeSection title="Suggested QBank" icon={<ListChecks size={20} aria-hidden />}
          empty="Suggested practice questions will appear here." />
        <HomeSection title="Suggested video" icon={<PlayCircle size={20} aria-hidden />}
          empty="A lecture picked for you will appear here." />
        <HomeSection title="Recent video" icon={<Clock size={20} aria-hidden />}
          empty="Lectures you watch will appear here." />
        <HomeSection title="Share" icon={<Share2 size={20} aria-hidden />}>
          <p className="muted-copy" style={{ marginBottom: "0.75rem" }}>
            Know a colleague who would benefit?
          </p>
          <ShareButton />
        </HomeSection>
      </div>
    </>
  );
}