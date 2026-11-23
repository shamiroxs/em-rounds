"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="empty-state" role="alert">
      <h1 className="section-title">Something went wrong</h1>
      <p>We couldn&apos;t load this page. Please try again.</p>
      <button className="primary-button" onClick={reset}>Try again</button>
    </div>
  );
}