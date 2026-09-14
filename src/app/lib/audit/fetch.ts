// src/app/lib/audit/fetch.ts
// A fetch wrapper for the server-side Supabase clients. On every MUTATING
// PostgREST request it forwards the audit headers of the current Next.js
// request, so the audit_row_change() trigger can name the admin behind a
// service-role write. Reads are passed through untouched — they never look at
// request headers, which keeps ISR-cached pages static.
import "server-only";
import { AUDIT_HEADERS, AUDIT_WRITE_RPCS } from "./headers";
import { readAuditContext } from "./context";

const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** True for table writes and for the RPCs listed in AUDIT_WRITE_RPCS. */
export function isAuditedMutation(url: string, method: string): boolean {
  if (READ_METHODS.has(method)) return false;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return false;
  }
  const rest = pathname.indexOf("/rest/v1/");
  if (rest === -1) return false; // auth / storage calls have no row trigger
  const tail = pathname.slice(rest + "/rest/v1/".length);
  if (tail.startsWith("rpc/")) {
    const fn = tail.slice("rpc/".length).split("/")[0];
    return AUDIT_WRITE_RPCS.has(fn);
  }
  return true;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export const auditingFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (!isAuditedMutation(requestUrl(input), method)) return fetch(input, init);

  const ctx = await readAuditContext();
  if (!ctx) return fetch(input, init);

  const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (ctx.actorId) h.set(AUDIT_HEADERS.actor, ctx.actorId);
  if (ctx.actorEmail) h.set(AUDIT_HEADERS.actorEmail, ctx.actorEmail);
  if (ctx.requestId) h.set(AUDIT_HEADERS.request, ctx.requestId);
  if (ctx.route) h.set(AUDIT_HEADERS.route, ctx.route);
  return fetch(input, { ...init, headers: h });
};
