// src/app/api/auth/sign-out/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';

// Support both POST (recommended) and GET (for simple anchor links)
export async function POST(req: Request) {
  const supabase = await createSupabaseRouteClient();
  await supabase.auth.signOut(); // clears auth cookies for this session
  return NextResponse.redirect(new URL('/login', req.url));
}

export async function GET(req: Request) {
  return POST(req);
}
