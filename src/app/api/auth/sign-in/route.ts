import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { checkLimit } from '@/app/lib/rate-limit';
import { safeNextUrl } from '@/app/lib/safe-redirect';
import { validateCsrfToken } from '@/app/lib/csrf';

export async function POST(req: Request) {
  const form = await req.formData();
  const csrfToken = String(form.get('_csrf') || '');
  if (!(await validateCsrfToken(csrfToken))) {
    return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  const email = String(form.get('email') || '');
  const password = String(form.get('password') || '');
  const nextRaw = String(form.get('next') || '');
  const safeNext = safeNextUrl(nextRaw);

  const url = new URL(req.url);

  // Per-email rate limit: 5 attempts per 15 minutes
  // Stops distributed brute force even when attackers rotate IPs
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail) {
    const emailLimit = await checkLimit(`auth-email:${normalizedEmail}`, 5, 900);
    if (!emailLimit.success) {
      url.pathname = '/login';
      url.searchParams.set('error', 'Too many login attempts. Please try again later.');
      if (nextRaw) url.searchParams.set('next', nextRaw);
      return NextResponse.redirect(url);
    }
  }

  const supabase = await createSupabaseRouteClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('Auth sign-in error:', error.message);
    url.pathname = '/login';
    url.searchParams.set('error', 'Invalid email or password');
    if (nextRaw) url.searchParams.set('next', nextRaw);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(safeNext, req.url));
}
