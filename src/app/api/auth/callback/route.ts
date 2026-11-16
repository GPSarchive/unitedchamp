import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { safeNextUrl } from '@/app/lib/safe-redirect';
import { isStaff } from '@/app/lib/supabase/apiAuth';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const nextRaw = url.searchParams.get('next') || '';
  const safeNext = safeNextUrl(nextRaw, '/dashboard');

  const supabase = await createSupabaseRouteClient();

  if (!code) {
    const back = new URL('/login', url);
    back.searchParams.set('error', 'Authentication failed');
    if (nextRaw) back.searchParams.set('next', nextRaw);
    return NextResponse.redirect(back);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('Auth callback error:', error.message);
    const back = new URL('/login', url);
    back.searchParams.set('error', 'Authentication failed');
    if (nextRaw) back.searchParams.set('next', nextRaw);
    return NextResponse.redirect(back);
  }

  // Players have no area yet: anyone who isn't staff gets the /login teaser
  // (the dashboard would only answer 403).
  if (!isStaff(data.user)) return NextResponse.redirect(new URL('/login', url));

  return NextResponse.redirect(new URL(safeNext, url));
}
