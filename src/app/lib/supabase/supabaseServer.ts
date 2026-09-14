import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { auditingFetch } from '@/app/lib/audit/fetch';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Use in Route Handlers and Server Actions ONLY (can set/delete cookies).
 *
 * Writes through this client run under the user's own JWT, so the audit
 * trigger already knows who they are (auth.uid()); auditingFetch only adds
 * the request id + route so those rows group with the rest of the request.
 */
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies(); // ← await in Next 15

  return createServerClient(url, key, {
    global: { fetch: auditingFetch },
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options?: any) {
        // both object form and (name, value, options) are valid
        cookieStore.set({ name, value, ...(options ?? {}) });
      },
      remove(name: string) {
        // delete is allowed in Server Actions / Route Handlers
        cookieStore.delete(name);
      },
    },
  });
}

/**
 * Use in Server Components (RSC) ONLY (read-only: no writes).
 * Writes are handled by middleware / route handlers.
 */
export async function createSupabaseRSCClient() {
  const cookieStore = await cookies(); // ← await in Next 15

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {/* no-op in RSC */},
      remove() {/* no-op in RSC */},
    },
  });
}
