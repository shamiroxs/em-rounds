import { ListChecks } from "lucide-react";

export default function QBankPage() {
  return (
    <div className="empty-state">
      <ListChecks size={32} aria-hidden />
      <h1 className="section-title">QBank is coming soon</h1>
      <p>Practice questions will arrive in a later release.</p>
    </div>
  );
}