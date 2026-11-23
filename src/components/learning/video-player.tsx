"use client";

import { useRef } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { saveProgress } from "@/app/actions/learning";

export function VideoPlayer({
  lectureId,
  playbackId,
  token,
  title,
  startTime,
}: {
  lectureId: string;
  playbackId: string;
  token: string;
  title: string;
  startTime: number;
}) {
  const lastSaved = useRef(0);

  function persist(seconds: number) {
    lastSaved.current = Date.now();
    void saveProgress(lectureId, seconds);
  }

  return (
    <div className="video-frame">
      <MuxPlayer
        playbackId={playbackId}
        tokens={{ playback: token }}
        metadata={{ video_title: title }}
        startTime={startTime}
        accentColor="#ad741e"
        onTimeUpdate={(e) => {
          if (Date.now() - lastSaved.current < 15000) return;
          persist((e.currentTarget as HTMLMediaElement).currentTime);
        }}
        onPause={(e) => persist((e.currentTarget as HTMLMediaElement).currentTime)}
        onEnded={(e) => persist((e.currentTarget as HTMLMediaElement).currentTime)}
      />
    </div>
  );
}