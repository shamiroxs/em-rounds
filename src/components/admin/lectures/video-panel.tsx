"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { StatusBadge } from "@/components/admin/ui";
import {
  attachPlaybackId,
  createVideoUpload,
  refreshVideoStatus,
  removeVideo,
} from "@/app/admin/lectures/video-actions";

const MuxUploader = dynamic(() => import("@mux/mux-uploader-react"), {
  ssr: false,
  loading: () => <div className="skeleton" style={{ height: "6rem" }} />,
});

export type VideoView = {
  id: string;
  status: string;
  playbackId: string | null;
  durationLabel: string | null;
  providerAssetId: string | null;
  errorMessage: string | null;
  source: string | null;
};

export function VideoPanel({
  lectureId,
  attached,
  pending,
  canChange,
  muxConfigured,
  isPublished,
  previewHref,
}: {
  lectureId: string;
  attached: VideoView | null;
  pending: VideoView | null;
  canChange: boolean;
  muxConfigured: boolean;
  isPublished: boolean;
  previewHref: string;
}) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [playbackInput, setPlaybackInput] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const endpointFailed = useRef(false);

  const inProgress = pending?.status === "waiting" || pending?.status === "processing";

  // While Mux is working, re-read OUR database every few seconds (the webhook updates it).
  useEffect(() => {
    if (!inProgress) return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > 200) return clearInterval(timer);
      router.refresh();
    }, 8000);
    return () => clearInterval(timer);
  }, [inProgress, router]);

  function checkStatus() {
    startTransition(async () => {
      const result = await refreshVideoStatus(lectureId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      router.refresh();
    });
  }

  function attach() {
    startTransition(async () => {
      const result = await attachPlaybackId(lectureId, playbackInput);
      if (result.ok) {
        toast.success("Video attached.");
        setPlaybackInput("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeVideo(lectureId);
      if (result.ok) {
        toast.success("Video removed from this lecture.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
      setConfirmRemove(false);
    });
  }

  return (
    <div style={{ display: "grid", gap: "1.2rem" }}>
      {/* Current video */}
      <div>
        <p className="field-label">Current video</p>
        {!attached ? (
          <p className="muted-copy" role="status">No video is attached to this lecture.</p>
        ) : attached.playbackId ? (
          <div className="muted-copy" style={{ fontSize: "0.92rem", display: "grid", gap: "0.35rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <StatusBadge status="ready" />
              {attached.durationLabel && <span>Duration {attached.durationLabel}</span>}
              {attached.source === "manual" && <span>(attached from an existing Mux video)</span>}
            </div>
            <span>Playback ID: <code>{attached.playbackId}</code></span>
            <span>
              <Link href={previewHref} className="text-link">Preview this lecture as a student would see it</Link>
            </span>
          </div>
        ) : (
          <p className="error-box" role="alert">
            A video record is attached, but it has no playable ID, so students see “video unavailable”.
            Upload the video again, or attach a playback ID.
          </p>
        )}
      </div>

      {/* Newer upload in progress or failed */}
      {pending && (
        <div className="surface-card" style={{ margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
            <StatusBadge status={pending.status} />
            <span className="muted-copy" style={{ fontSize: "0.92rem" }}>
              {pending.status === "waiting" && "Waiting for the upload to finish. Keep this page open until the upload bar completes."}
              {pending.status === "processing" && "Mux is processing the video. This usually takes a few minutes. This page updates by itself."}
              {pending.status === "error" && (pending.errorMessage ?? "The video could not be processed.")}
              {pending.status !== "waiting" && pending.status !== "processing" && pending.status !== "error" && "Status unknown."}
            </span>
          </div>
          {attached?.playbackId && inProgress && (
            <p className="admin-stat-sub">The current video keeps playing until the new one is ready.</p>
          )}
          <div style={{ marginTop: "0.8rem" }}>
            <button type="button" className="secondary-button" onClick={checkStatus} disabled={busy}>
              {busy ? "Checking…" : "Check status now"}
            </button>
          </div>
        </div>
      )}

      {/* Upload */}
      {canChange ? (
        muxConfigured ? (
          <div>
            <p className="field-label">Upload a new video</p>
            <p className="field-hint" style={{ marginBottom: "0.6rem" }}>
              The file goes straight to Mux, not through this website. Large files can take several
              minutes. Videos are private: students need access to watch them, and downloading is not offered.
            </p>
            <MuxUploader
              endpoint={async () => {
                const result = await createVideoUpload(lectureId);
                if (!result.ok) {
                  endpointFailed.current = true;
                  toast.error(result.error);
                  throw new Error(result.error);
                }
                return result.uploadUrl;
              }}
              onSuccess={() => {
                toast.success("Upload finished. Mux is now processing the video.");
                router.refresh();
              }}
              onError={(event: unknown) => {
                if (endpointFailed.current) {
                  endpointFailed.current = false;
                  return;
                }
                const detail = (event as { detail?: unknown } | null)?.detail;
                toast.error(
                  typeof detail === "string" && detail ? detail : "The upload failed. Please try again.",
                );
              }}
            />
          </div>
        ) : (
          <p className="error-box" role="status">
            Video upload is not available because MUX_TOKEN_ID and MUX_TOKEN_SECRET are not set on the server.
          </p>
        )
      ) : (
        <p className="muted-copy" role="status">
          Only an administrator can change the video of a published or archived lecture.
        </p>
      )}

      {/* Attach an existing Mux video */}
      {canChange && muxConfigured && (
        <details>
          <summary className="field-label" style={{ cursor: "pointer" }}>
            Attach a video that is already in Mux
          </summary>
          <div style={{ display: "grid", gap: "0.6rem", marginTop: "0.6rem" }}>
            <label className="field-label" htmlFor="playbackId">Signed playback ID</label>
            <input
              id="playbackId"
              className="field-input"
              value={playbackInput}
              onChange={(e) => setPlaybackInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-describedby="playback-hint"
            />
            <p id="playback-hint" className="field-hint">
              Public playback IDs are refused so that student access control cannot be bypassed.
            </p>
            <div>
              <button type="button" className="secondary-button" onClick={attach} disabled={busy || !playbackInput.trim()}>
                {busy ? "Checking with Mux…" : "Verify and attach"}
              </button>
            </div>
          </div>
        </details>
      )}

      {/* Remove */}
      {canChange && attached && (
        <div>
          <button
            type="button"
            className="secondary-button"
            style={{ color: "var(--danger-text)", borderColor: "var(--danger-border)" }}
            disabled={busy || isPublished}
            onClick={() => setConfirmRemove(true)}
          >
            Remove video from this lecture
          </button>
          {isPublished && <p className="field-hint">Unpublish the lecture first.</p>}
        </div>
      )}
      <ConfirmDialog
        open={confirmRemove}
        title="Remove the video from this lecture?"
        description="The lecture will have no video. The file stays in your Mux account (delete it there if you no longer need it)."
        confirmLabel="Remove video"
        destructive
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}