import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { validatePassword } from '@/app/lib/password-validation';
import { validateCsrfToken } from '@/app/lib/csrf';

export async function POST(req: Request) {
  const form = await req.formData();
  const csrfToken = String(form.get('_csrf') || '');
  if (!(await validateCsrfToken(csrfToken))) {
    return NextResponse.json({ error: 'Invalid or missing CSRF token' }, { status: 403 });
  }

  const email = String(form.get('email') || '');
  const password = String(form.get('password') || '');
  const passwordConfirm = String(form.get('passwordConfirm') || '');

  const url = new URL(req.url);
  const confirmUrl = new URL('/api/auth/confirm', url).toString();

  if (!email || !password) {
    return NextResponse.redirect(new URL(`/sign-up?error=${encodeURIComponent('Email and password are required')}`, url));
  }
  if (password !== passwordConfirm) {
    return NextResponse.redirect(
      new URL(`/sign-up?error=${encodeURIComponent('Passwords do not match')}&email=${encodeURIComponent(email)}`, url)
    );
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    return NextResponse.redirect(
      new URL(`/sign-up?error=${encodeURIComponent(passwordError)}&email=${encodeURIComponent(email)}`, url)
    );
  }

  const supabase = await createSupabaseRouteClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: confirmUrl },
  });

  if (error) {
    console.error('Auth sign-up error:', error.message);
    return NextResponse.redirect(
      new URL(`/sign-up?error=${encodeURIComponent('Unable to create account')}&email=${encodeURIComponent(email)}`, url)
    );
  }

  // If email confirmations are ON, data.session is null → show "check your email"
  if (!data.session) {
    const jar = await cookies();
    jar.set('__pending_email', email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 300, // 5 minutes
    });
    return NextResponse.redirect(new URL('/check-email', url));
  }

  // If confirmations are OFF (auto-confirm), user is already signed in
  return NextResponse.redirect(new URL('/dashboard', url));
}
