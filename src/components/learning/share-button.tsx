"use client";

import { toast } from "sonner";
import { Share2 } from "lucide-react";

export function ShareButton() {
  async function share() {
    const url = window.location.origin;
    const data = {
      title: "EM ROUNDS with PK",
      text: "Emergency medicine education by Dr. Roshan PK",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      // The user closed the share sheet, or clipboard access was denied.
    }
  }

  return (
    <button className="secondary-button btn-compact" onClick={share}>
      <Share2 size={18} aria-hidden /> Share EM ROUNDS
    </button>
  );
}