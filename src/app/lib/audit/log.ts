// src/app/lib/audit/log.ts
// App-level audit events: one row per admin ACTION ("closed season 2025-2026",
// "deleted storage object …", "granted editor to …"). Row-level changes are
// captured independently by the database triggers (source = 'db'); this is
// for things a single row can't express — cache rebuilds, storage operations,
// role changes made through GoTrue, or a one-line summary of a bulk save.
//
// Never throws. A logging failure is reported to the server log and the admin
// action continues: the DB triggers remain the reliable record.
import "server-only";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { readAuditContext } from "./context";

export type AuditActor = { id: string; email?: string | null };

export type AdminActionInput = {
  /** Dotted verb, e.g. "role.grant", "season.close", "storage.delete". */
  action: string;
  /** Table the action is about, if any (e.g. "tournaments"). */
  table?: string | null;
  /** Primary key of the record the action is about, if any. */
  recordId?: string | number | null;
  /** One human-readable line shown in the dashboard history. */
  summary?: string | null;
  /** Anything structured worth keeping (counts, paths, old/new values). */
  meta?: Record<string, unknown> | null;
  /**
   * The verified caller. Pass it when the handler has it (it always does after
   * its auth check); otherwise the proxy-stamped request headers are used.
   */
  actor?: AuditActor | null;
};

export async function logAdminAction(input: AdminActionInput): Promise<void> {
  try {
    const ctx = await readAuditContext();
    const actorId = input.actor?.id ?? ctx?.actorId ?? null;
    const actorEmail = input.actor?.email ?? ctx?.actorEmail ?? null;
    const { error } = await supabaseAdmin.from("audit_log").insert({
      source: "app",
      op: input.action,
      table_name: input.table ?? null,
      record_id: input.recordId == null ? null : String(input.recordId),
      actor_id: actorId,
      actor_email: actorEmail,
      db_role: "service_role",
      request_id: ctx?.requestId ?? null,
      route: ctx?.route ?? null,
      summary: input.summary ?? null,
      meta: input.meta ?? null,
    });
    if (error) console.error("[audit] logAdminAction failed:", input.action, error.message);
  } catch (e) {
    console.error("[audit] logAdminAction threw:", input.action, e);
  }
}
