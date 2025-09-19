// app/api/admin/users/[id]/roles/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';

type Ctx = { params: Promise<{ id: string }> }; // ← params is a Promise

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;               // ← await params

  // 1) Who is calling?
  const supabase = await createSupabaseRouteClient();
  const { data: { user: caller } } = await supabase.auth.getUser();
  if (!caller) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  // 2) Are they an admin?
  const callerRoles = (caller.app_metadata?.roles ?? []) as string[];
  if (!callerRoles.includes('admin')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // 3) Read payload (form or JSON)
  const ct = req.headers.get('content-type') || '';
  let makeAdmin: boolean | null = null;
  let returnTo: string | null = null;

  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    if ('admin' in body) makeAdmin = !!(body as any).admin;
  } else {
    const form = await req.formData();
    makeAdmin = form.has('admin');                // checkbox present → true
    returnTo = String(form.get('returnTo') || '');
  }
  if (makeAdmin === null) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

  // 4) Get current roles for target user
  const { data: target, error: getErr } = await supabaseAdmin.auth.admin.getUserById(id);
  if (getErr || !target?.user) {
    return NextResponse.json({ error: getErr?.message || 'user not found' }, { status: 404 });
  }

  const currentRoles: string[] = Array.isArray(target.user.app_metadata?.roles)
    ? (target.user.app_metadata!.roles as string[])
    : [];
  const newRoles = makeAdmin
    ? Array.from(new Set([...currentRoles, 'admin']))
    : currentRoles.filter((r) => r !== 'admin');

  // 5) Persist roles
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
    app_metadata: { roles: newRoles },
  });
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  // 6) Redirect for form posts; JSON for programmatic calls
  if (!ct.includes('application/json')) {
    const location = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
    return NextResponse.redirect(new URL(location, req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, roles: newRoles });
}
