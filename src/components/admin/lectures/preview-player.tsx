"use client";

import MuxPlayer from "@mux/mux-player-react";

// Plays the video WITHOUT saving any watch progress (unlike the student player).
export function PreviewPlayer({
  playbackId,
  token,
  title,
}: {
  playbackId: string;
  token: string;
  title: string;
}) {
  return (
    <div className="video-frame">
      <MuxPlayer
        playbackId={playbackId}
        tokens={{ playback: token }}
        metadata={{ video_title: title }}
        accentColor="#ad741e"
      />
    </div>
  );
}