// The admin screens use Indian Standard Time (UTC+5:30, no daylight saving).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** ISO timestamp -> value for <input type="datetime-local"> in IST. */
export function isoToIstInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
}

/** "2026-12-01T09:30" typed in IST -> ISO timestamp, or null if invalid. */
export function istInputToIso(value: string): string | null {
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  const d = new Date(`${v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}