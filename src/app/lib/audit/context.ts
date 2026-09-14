// src/app/lib/audit/context.ts
// Reads the audit attribution the proxy stamped on the current request.
// Node runtime only (route handlers, server actions, after() callbacks).
import "server-only";
import { headers } from "next/headers";
import { AUDIT_HEADERS } from "./headers";

export type AuditContext = {
  actorId: string | null;
  actorEmail: string | null;
  requestId: string | null;
  route: string | null;
};

/**
 * The verified caller + request id for the current request, or null when
 * there is no request scope (scripts, build-time rendering, cache scopes).
 * Never throws: attribution is best-effort here; the DB trigger still records
 * the row change with db_role = service_role when no actor is known.
 */
export async function readAuditContext(): Promise<AuditContext | null> {
  try {
    const h = await headers();
    const actorId = h.get(AUDIT_HEADERS.actor);
    const actorEmail = h.get(AUDIT_HEADERS.actorEmail);
    const requestId = h.get(AUDIT_HEADERS.request);
    const route = h.get(AUDIT_HEADERS.route);
    if (!actorId && !requestId && !route) return null;
    return {
      actorId: actorId || null,
      actorEmail: actorEmail || null,
      requestId: requestId || null,
      route: route || null,
    };
  } catch {
    return null;
  }
}
