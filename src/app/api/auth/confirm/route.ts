// src/app/api/auth/confirm/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';

type EmailFlow =
  | 'signup'
  | 'recovery'
  | 'email_change'
  | 'magiclink'
  | 'invite';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code'); // sometimes present
  const token_hash = url.searchParams.get('token_hash'); // email links
  const type = (url.searchParams.get('type') || 'signup') as EmailFlow;

  const nextRaw = url.searchParams.get('next') || '';
  const safeNext =
    nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';

  const supabase = await createSupabaseRouteClient();

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (token_hash) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash });
      if (error) throw error;
    } else {
      // Neither present — nothing to exchange/verify
      const back = new URL('/login', url);
      back.searchParams.set('error', 'Missing verification token');
      if (nextRaw) back.searchParams.set('next', nextRaw);
      return NextResponse.redirect(back);
    }
  } catch (e: any) {
    const back = new URL('/login', url);
    back.searchParams.set('error', e?.message || 'Verification failed');
    if (nextRaw) back.searchParams.set('next', nextRaw);
    return NextResponse.redirect(back);
  }

  return NextResponse.redirect(new URL(safeNext, url));
}
