import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { validateCsrfToken } from '@/app/lib/csrf';
import { checkLimit } from '@/app/lib/rate-limit';

export async function POST(req: Request) {
  const form = await req.formData();
  const csrfToken = String(form.get('_csrf') || '');
  if (!(await validateCsrfToken(csrfToken))) {
    return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  const email = String(form.get('email') || '');

  const url = new URL(req.url);
  if (!email) {
    return NextResponse.redirect(new URL('/check-email?msg=' + encodeURIComponent('Enter an email'), url));
  }

  // Per-email resend limit: 3 per hour to prevent email spam
  const normalizedEmail = email.trim().toLowerCase();
  const resendLimit = await checkLimit(`resend-email:${normalizedEmail}`, 3, 3600);
  if (!resendLimit.success) {
    const jar = await cookies();
    jar.set('__pending_email', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 300,
    });
    return NextResponse.redirect(
      new URL(`/check-email?msg=${encodeURIComponent('Too many resend requests. Please try again later.')}`, url)
    );
  }

  const supabase = await createSupabaseRouteClient();
  // resend: 'signup' type for a fresh confirmation link
  const { error } = await supabase.auth.resend({ type: 'signup', email });

  if (error) {
    console.error('Auth resend error:', error.message);
  }

  // Set email in HttpOnly cookie instead of URL params
  const jar = await cookies();
  jar.set('__pending_email', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 300,
  });

  // Always show the same message whether the email exists or not
  return NextResponse.redirect(
    new URL(`/check-email?msg=${encodeURIComponent('If this email is registered, a link has been sent.')}`, url)
  );
}
