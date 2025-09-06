import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabaseServer';

export async function POST(req: Request) {
  const form = await req.formData();
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

  const supabase = await createSupabaseRouteClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: confirmUrl },
  });

  if (error) {
    return NextResponse.redirect(
      new URL(`/sign-up?error=${encodeURIComponent(error.message)}&email=${encodeURIComponent(email)}`, url)
    );
  }

  // If email confirmations are ON, data.session is null → show "check your email"
  if (!data.session) {
    return NextResponse.redirect(new URL(`/check-email?email=${encodeURIComponent(email)}`, url));
  }

  // If confirmations are OFF (auto-confirm), user is already signed in
  return NextResponse.redirect(new URL('/dashboard', url));
}
