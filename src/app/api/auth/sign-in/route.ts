import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabaseServer';

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get('email') || '');
  const password = String(form.get('password') || '');
  const nextRaw = String(form.get('next') || '');
  const safeNext = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/home';

  const supabase = await createSupabaseRouteClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  const url = new URL(req.url);
  if (error) {
    url.pathname = '/login';
    url.searchParams.set('error', error.message);
    if (nextRaw) url.searchParams.set('next', nextRaw);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(safeNext, req.url));
}
