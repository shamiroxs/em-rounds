"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bookmark, BookmarkCheck, CheckCircle2, Circle } from "lucide-react";
import { setBookmark, setCompletion } from "@/app/actions/learning";

export function LectureActions({
  lectureId,
  initialBookmarked,
  initialCompleted,
}: {
  lectureId: string;
  initialBookmarked: boolean;
  initialCompleted: boolean;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [completed, setCompleted] = useState(initialCompleted);
  const [pending, startTransition] = useTransition();

  function toggleBookmark() {
    const next = !bookmarked;
    startTransition(async () => {
      const res = await setBookmark(lectureId, next);
      if (res.ok) {
        setBookmarked(next);
        toast.success(next ? "Lecture bookmarked" : "Bookmark removed");
      } else toast.error(res.error);
    });
  }

  function toggleComplete() {
    const next = !completed;
    startTransition(async () => {
      const res = await setCompletion(lectureId, next);
      if (res.ok) {
        setCompleted(next);
        toast.success(next ? "Marked as complete" : "Marked as incomplete");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="action-row">
      <button className="secondary-button btn-compact" onClick={toggleBookmark}
        disabled={pending} aria-pressed={bookmarked}>
        {bookmarked ? <BookmarkCheck size={18} aria-hidden /> : <Bookmark size={18} aria-hidden />}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </button>
      <button className="secondary-button btn-compact" onClick={toggleComplete}
        disabled={pending} aria-pressed={completed}>
        {completed ? <CheckCircle2 size={18} aria-hidden /> : <Circle size={18} aria-hidden />}
        {completed ? "Completed" : "Mark as complete"}
      </button>
    </div>
  );
}