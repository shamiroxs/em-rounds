import { createAdminClient } from "@/lib/supabase/admin";

// Keys that must never be written to an audit record.
const SENSITIVE_KEY = /pass(word)?|secret|token|api[_-]?key|private[_-]?key|authorization|cookie/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : sanitize(v, depth + 1);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 500) return value.slice(0, 500) + "…";
  return value;
}

export type AuditEntry = {
  actorUserId: string;
  /** e.g. "course.create", "lecture.publish" */
  action: string;
  /** e.g. "course", "lecture" */
  entityType: string;
  entityId?: string | null;
  /** Small summary of what changed. Never put secrets here. */
  details?: Record<string, unknown>;
};

/**
 * Appends one row to public.admin_audit_logs.
 *
 * Browser sessions have no INSERT permission on that table, so this uses the
 * server-only service-role client. It is called only after the caller has
 * already been authorized. The table is append-only (a database trigger blocks
 * UPDATE and DELETE).
 *
 * Best effort: a logging failure is reported to the server log but does not
 * undo the change that was already saved. Returns true when the row was written.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) {
    console.error("Audit log skipped: service role is not configured.");
    return false;
  }
  const { error } = await admin.from("admin_audit_logs").insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    details: sanitize(entry.details ?? {}),
  });
  if (error) {
    console.error("Audit log write failed:", error.code, error.message);
    return false;
  }
  return true;
}
