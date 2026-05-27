// app/api/auth/oauth/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { getBaseUrl } from '@/app/lib/getBaseUrl';
import type { Provider } from '@supabase/supabase-js';

const ENABLED_PROVIDERS = new Set<Provider>(['google', 'github']);

export async function GET(req: Request) {
  const baseUrl = getBaseUrl(req);
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') as Provider | null;
  const nextRaw = url.searchParams.get('next') || '';

  if (!provider || !ENABLED_PROVIDERS.has(provider)) {
    const back = new URL('/login', baseUrl);
    back.searchParams.set('error', 'Authentication failed');
    if (nextRaw) back.searchParams.set('next', nextRaw);
    return NextResponse.redirect(back);
  }

  const supabase = await createSupabaseRouteClient();

  const callback = new URL('/api/auth/callback', baseUrl);
  if (nextRaw) callback.searchParams.set('next', nextRaw);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString() },
  });

  if (error) {
    console.error('Auth OAuth error:', error.message);
    const back = new URL('/login', baseUrl);
    back.searchParams.set('error', 'Authentication failed');
    if (nextRaw) back.searchParams.set('next', nextRaw);
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(data.url);
}
