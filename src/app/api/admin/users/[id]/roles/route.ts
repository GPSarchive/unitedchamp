// app/api/admin/users/[id]/roles/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';
import { safeNextUrl } from '@/app/lib/safe-redirect';

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
  //    `role` selects which role to toggle ('admin' | 'editor'), defaulting to
  //    'admin' for backward compatibility. `enabled` (JSON) / checkbox presence
  //    (form) decides whether to grant or revoke it.
  const ASSIGNABLE_ROLES = ['admin', 'editor'] as const;
  type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

  const ct = req.headers.get('content-type') || '';
  let targetRole: AssignableRole = 'admin';
  let enable: boolean | null = null;
  let returnTo: string | null = null;

  if (ct.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.role === 'string' && (ASSIGNABLE_ROLES as readonly string[]).includes(body.role)) {
      targetRole = body.role as AssignableRole;
    }
    // Back-compat: { admin: boolean } still toggles the admin role.
    if ('admin' in body) { targetRole = 'admin'; enable = !!body.admin; }
    else if ('enabled' in body) { enable = !!body.enabled; }
  } else {
    const form = await req.formData();
    const formRole = String(form.get('role') || '');
    if ((ASSIGNABLE_ROLES as readonly string[]).includes(formRole)) {
      targetRole = formRole as AssignableRole;
    }
    enable = form.has('enabled');                 // checkbox present → grant
    returnTo = String(form.get('returnTo') || '');
  }
  if (enable === null) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

  // 4) Get current roles for target user
  const { data: target, error: getErr } = await supabaseAdmin.auth.admin.getUserById(id);
  if (getErr || !target?.user) {
    return NextResponse.json({ error: getErr?.message || 'user not found' }, { status: 404 });
  }

  const currentRoles: string[] = Array.isArray(target.user.app_metadata?.roles)
    ? (target.user.app_metadata!.roles as string[])
    : [];
  const newRoles = enable
    ? Array.from(new Set([...currentRoles, targetRole]))
    : currentRoles.filter((r) => r !== targetRole);

  // 5) Persist roles
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
    app_metadata: { roles: newRoles },
  });
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 });

  // 6) Redirect for form posts; JSON for programmatic calls
  if (!ct.includes('application/json')) {
    const location = safeNextUrl(returnTo ?? '', '/dashboard');
    return NextResponse.redirect(new URL(location, req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, roles: newRoles });
}
