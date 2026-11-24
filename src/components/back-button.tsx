"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export function BackButton({
  fallbackHref = "/home",
  label = "Back",
}: {
  fallbackHref?: string;
  label?: string;
}) {
  const router = useRouter();

  function goBack() {
    // If there is no earlier page in this tab, go to the fallback instead.
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return (
    <button type="button" onClick={goBack} className="text-link breadcrumb"
      style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}>
      <ChevronLeft size={16} aria-hidden /> {label}
    </button>
  );
}