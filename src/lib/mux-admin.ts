// Server-only helper for the Mux Video API (creating uploads, checking status).
// Uses MUX_TOKEN_ID / MUX_TOKEN_SECRET. These must never be sent to the browser.

const API = "https://api.mux.com";

export class MuxApiError extends Error {}

export function muxConfigured() {
  return Boolean(process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET);
}

async function muxFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const id = process.env.MUX_TOKEN_ID;
  const secret = process.env.MUX_TOKEN_SECRET;
  if (!id || !secret) throw new MuxApiError("Mux is not configured on the server.");

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new MuxApiError("Could not reach Mux. Please try again.");
  }

  if (!res.ok) {
    // Log only the status and path, never the response body.
    console.error("Mux API error:", res.status, path);
    throw new MuxApiError(
      res.status === 401 || res.status === 403
        ? "Mux rejected the server credentials. Check MUX_TOKEN_ID and MUX_TOKEN_SECRET."
        : res.status === 404
          ? "Mux could not find that item."
          : "Mux returned an error. Please try again.",
    );
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export type MuxPlaybackId = { id: string; policy: string };

export type MuxAsset = {
  id: string;
  status: string; // preparing | ready | errored
  duration?: number | null;
  playback_ids?: MuxPlaybackId[];
  errors?: { type?: string; messages?: string[] } | null;
  passthrough?: string | null;
  upload_id?: string | null;
};

export type MuxUpload = {
  id: string;
  status: string; // waiting | asset_created | errored | cancelled | timed_out
  url?: string;
  asset_id?: string | null;
  error?: { type?: string; message?: string } | null;
};

/** Creates a one-time upload link. Assets are SIGNED-only and have no MP4 download. */
export function createDirectUpload(opts: { corsOrigin: string; passthrough: string }) {
  return muxFetch<MuxUpload>("/video/v1/uploads", {
    method: "POST",
    body: {
      cors_origin: opts.corsOrigin,
      timeout: 7200,
      new_asset_settings: {
        playback_policies: ["signed"],
        video_quality: "basic",
        passthrough: opts.passthrough,
      },
    },
  });
}

export const getUpload = (id: string) =>
  muxFetch<MuxUpload>(`/video/v1/uploads/${encodeURIComponent(id)}`);

export const getAsset = (id: string) =>
  muxFetch<MuxAsset>(`/video/v1/assets/${encodeURIComponent(id)}`);

export const getPlaybackIdInfo = (id: string) =>
  muxFetch<{ id: string; policy: string; object: { type: string; id: string } }>(
    `/video/v1/playback-ids/${encodeURIComponent(id)}`,
  );