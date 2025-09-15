// app/lib/supabaseServer.ts
import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Use in Server Components (RSC): READ cookies only.
 * Next.js forbids modifying cookies here.
 */
export async function createSupabaseRSCClient() {
  const jar = await cookies(); // Next 15: cookies() can be Promise-like
  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return jar.get(name)?.value;
      },
      // NO-OPs in RSC to avoid "Cookies can only be modified..." error
      set(_name: string, _value: string, _opts?: CookieOptions) {},
      remove(_name: string, _opts?: CookieOptions) {},
    },
  });
}

/**
 * Use ONLY in Server Actions or Route Handlers:
 * allowed to set/delete cookies.
 */
export async function createSupabaseRouteClient() {
  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return jar.get(name)?.value;
      },
      set(name: string, value: string, opts?: CookieOptions) {
        jar.set({ name, value, ...(opts ?? {}) });
      },
      remove(name: string, opts?: CookieOptions) {
        // delete via maxAge:0 for broad compatibility
        jar.set({ name, value: '', ...(opts ?? {}), maxAge: 0 });
      },
    },
  });
}
