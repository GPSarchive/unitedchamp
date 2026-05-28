import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { validateCsrfToken } from '@/app/lib/csrf';
import { checkLimit } from '@/app/lib/rate-limit';

const GENERIC_MSG = 'If this email is registered, a link has been sent.';

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

  // Per-email resend limit: 3 per hour to prevent email spam.
  // We do NOT distinguish the rate-limited response from the success response —
  // returning different messages/statuses would let attackers enumerate which
  // emails are registered by probing the rate limit.
  const normalizedEmail = email.trim().toLowerCase();
  const resendLimit = await checkLimit(`resend-email:${normalizedEmail}`, 3, 3600);

  if (resendLimit.success) {
    // Only call Supabase when under the per-email limit. Errors here are logged
    // but never surfaced to the caller — same response either way.
    const supabase = await createSupabaseRouteClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) {
      console.error('Auth resend error:', error.message);
    }
  }

  // Always set the pending-email cookie and redirect with the same generic
  // message, regardless of whether we actually sent a mail.
  const jar = await cookies();
  jar.set('__pending_email', email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 300,
  });

  return NextResponse.redirect(
    new URL(`/check-email?msg=${encodeURIComponent(GENERIC_MSG)}`, url)
  );
}
