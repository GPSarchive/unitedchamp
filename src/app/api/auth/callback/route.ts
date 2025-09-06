import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabaseServer';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const nextRaw = url.searchParams.get('next') || '';
  const safeNext = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';

  const supabase = await createSupabaseRouteClient();

  if (!code) {
    const back = new URL('/login', url);
    back.searchParams.set('error', 'Missing authorization code');
    if (nextRaw) back.searchParams.set('next', nextRaw);
    return NextResponse.redirect(back);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const back = new URL('/login', url);
    back.searchParams.set('error', error.message);
    if (nextRaw) back.searchParams.set('next', nextRaw);
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(new URL(safeNext, url));
}
