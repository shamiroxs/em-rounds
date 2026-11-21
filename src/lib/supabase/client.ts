
"use client";

import { createClient } from "@supabase/supabase-js";

let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase environment variables are not configured."
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(
      supabaseUrl,
      supabasePublishableKey
    );
  }

  return supabaseClient;
}
