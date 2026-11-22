"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setBusy(true);
    setError("");
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError("Sign out failed. Please try again.");
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={signOut} disabled={busy} className="secondary-button px-4 py-2 text-sm">
        {busy ? "Signing out…" : "Sign out"}
      </button>
      {error && <span role="alert" className="text-xs"
style={{ color: "var(--danger-text)" }}>{error}</span>}
    </div>
  );
}
