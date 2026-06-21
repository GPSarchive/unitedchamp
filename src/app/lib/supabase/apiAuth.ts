// src/app/lib/supabase/apiAuth.ts
// Shared helpers for API route authentication. Import these instead of
// copy-pasting auth boilerplate in every route handler.
import 'server-only';
import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from './supabaseServer';

type AuthOk = { ok: true; user: NonNullable<any> };
type AuthFail = { ok: false; response: NextResponse };

/**
 * Reads the roles array off a Supabase user's app_metadata, defensively.
 * Always returns an array (empty if absent/malformed).
 */
export function rolesOf(user: any): string[] {
  return Array.isArray(user?.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : [];
}

/** True if the user has the 'admin' role. */
export const isAdmin = (user: any) => rolesOf(user).includes('admin');

/**
 * True if the user may edit content (matches, articles, announcements).
 * Admins implicitly qualify; editors qualify explicitly.
 */
export const canEditContent = (user: any) => {
  const r = rolesOf(user);
  return r.includes('admin') || r.includes('editor');
};

/**
 * Verifies a valid Supabase session exists (any authenticated user).
 * Returns the user on success, or a ready-to-return 401 NextResponse on failure.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (!auth.ok) return auth.response;
 *   const { user } = auth;
 */
export async function requireAuth(): Promise<AuthOk | AuthFail> {
  const supa = await createSupabaseRouteClient();
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true, user };
}

/**
 * Verifies a valid session AND that the caller has the 'admin' role in
 * app_metadata.roles. Returns the user on success, or a 401/403 response.
 *
 * Usage:
 *   const auth = await requireAdmin();
 *   if (!auth.ok) return auth.response;
 *   const { user } = auth;
 */
export async function requireAdmin(): Promise<AuthOk | AuthFail> {
  const supa = await createSupabaseRouteClient();
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  const roles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : [];
  if (!roles.includes('admin')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

/**
 * Verifies a valid session AND that the caller can edit content
 * (has 'admin' or 'editor' in app_metadata.roles). Returns the user on
 * success, or a 401/403 response.
 *
 * Usage:
 *   const auth = await requireEditor();
 *   if (!auth.ok) return auth.response;
 *   const { user } = auth;
 */
export async function requireEditor(): Promise<AuthOk | AuthFail> {
  const supa = await createSupabaseRouteClient();
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (!canEditContent(user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
