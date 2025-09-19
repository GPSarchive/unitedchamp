import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Use in Route Handlers and Server Actions ONLY (can set/delete cookies).
 */
export async function createSupabaseRouteClient() {
  const cookieStore = await cookies(); // ← await in Next 15

  return createServerClient(url, key, {
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
