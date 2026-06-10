import { NextResponse } from "next/server";

// Database/internal errors must not reach clients verbatim in production:
// Postgres/PostgREST messages can reveal table names, constraint names and
// query structure. The full error is always logged server-side.

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  const m = (error as { message?: unknown } | null)?.message;
  return typeof m === "string" ? m : String(error);
}

/** Log the error server-side and return a client-safe message. */
export function safeErrorMessage(error: unknown, context?: string): string {
  console.error(`[api${context ? `:${context}` : ""}]`, error);
  return process.env.NODE_ENV === "production"
    ? "Internal server error"
    : messageOf(error);
}

/** JSON error response that hides internal error details in production. */
export function dbError(error: unknown, status = 500, context?: string) {
  return NextResponse.json({ error: safeErrorMessage(error, context) }, { status });
}
