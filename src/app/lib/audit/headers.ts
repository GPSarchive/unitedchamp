// src/app/lib/audit/headers.ts
// Header names that carry audit attribution from the proxy (edge) to the
// Node runtime and on to PostgREST. Edge-safe: constants only, no imports.
//
// Flow (see docs/audit-log.md):
//   proxy.ts   strips any client-sent x-audit-* header, then stamps a request
//              id, the route and — once the session is verified — the actor.
//   fetch.ts   copies them onto every MUTATING PostgREST call the server makes.
//   Postgres   the audit_row_change() trigger reads them from request.headers
//              and trusts the actor headers ONLY on service-role requests
//              (a user JWT identifies its own caller via auth.uid()).

export const AUDIT_HEADERS = {
  /** auth.users.id of the verified caller (uuid). */
  actor: "x-audit-actor",
  /** Email of the verified caller, for readable history without a lookup. */
  actorEmail: "x-audit-actor-email",
  /** One id per HTTP request; groups the row changes one action produced. */
  request: "x-audit-request",
  /** "<METHOD> <pathname>" of the incoming request, e.g. "POST /api/matches/12". */
  route: "x-audit-route",
} as const;

export const AUDIT_HEADER_NAMES: readonly string[] = Object.values(AUDIT_HEADERS);

/**
 * PostgREST RPCs that WRITE. Attribution headers are attached to these; every
 * other rpc() call is treated as a read and left untouched, so a cached page
 * that calls a read RPC never touches request headers (which would opt it out
 * of ISR). Add a function here when a new writing RPC is introduced.
 */
export const AUDIT_WRITE_RPCS: ReadonlySet<string> = new Set([
  "create_tournament",
  "update_match_awards",
  "replace_stage_standings",
  "alloc_stage_slot",
  "flip_active_season",
  "set_active_season",
]);
