import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabaseServer';
import type { Provider } from '@supabase/supabase-js';

const ENABLED_PROVIDERS = new Set<Provider>(['github', 'google']);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get('provider') as Provider | null;
  const nextRaw = url.searchParams.get('next') || '';

  if (!provider || !ENABLED_PROVIDERS.has(provider)) {
    const back = new URL('/login', url);
    back.searchParams.set('error', 'Unsupported provider');
    if (nextRaw) back.searchParams.set('next', nextRaw);
    return NextResponse.redirect(back);
  }

  const supabase = await createSupabaseRouteClient();

  const callback = new URL('/api/auth/callback', url);
  if (nextRaw) callback.searchParams.set('next', nextRaw);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString() },
  });

  if (error) {
    const back = new URL('/login', url);
    back.searchParams.set('error', error.message);
    if (nextRaw) back.searchParams.set('next', nextRaw);
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(data.url);
}
