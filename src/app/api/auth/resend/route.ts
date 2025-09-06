import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabaseServer';

export async function POST(req: Request) {
  const form = await req.formData();
  const email = String(form.get('email') || '');

  const url = new URL(req.url);
  if (!email) {
    return NextResponse.redirect(new URL('/check-email?msg=' + encodeURIComponent('Enter an email'), url));
  }

  const supabase = await createSupabaseRouteClient();
  // resend: 'signup' type for a fresh confirmation link
  const { error } = await supabase.auth.resend({ type: 'signup', email });

  if (error) {
    return NextResponse.redirect(
      new URL(`/check-email?email=${encodeURIComponent(email)}&msg=${encodeURIComponent(error.message)}`, url)
    );
  }

  return NextResponse.redirect(
    new URL(`/check-email?email=${encodeURIComponent(email)}&msg=${encodeURIComponent('Link sent!')}`, url)
  );
}
