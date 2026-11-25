"use client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="admin-empty" role="alert">
      <h1 className="section-title" style={{ fontSize: "1.2rem" }}>Something went wrong</h1>
      <p className="muted-copy">This administration page could not be loaded. Please try again.</p>
      <button type="button" className="primary-button" onClick={reset}>Try again</button>
    </div>
  );
}
