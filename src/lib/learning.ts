export type Lecture = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
};
export type Topic = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  lectures: Lecture[];
};
export type Subject = {
  id: string;
  title: string;
  description: string | null;
  sort_order: number;
  topics: Topic[];
};

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function bySort<T extends { sort_order: number; title: string }>(a: T, b: T) {
  return a.sort_order - b.sort_order || a.title.localeCompare(b.title);
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}