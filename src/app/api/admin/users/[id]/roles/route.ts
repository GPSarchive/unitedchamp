// app/api/admin/users/[id]/roles/route.ts
import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';
import { safeNextUrl } from '@/app/lib/safe-redirect';
import { logAdminAction } from '@/app/lib/audit/log';
import { decideRoleChange, isAssignableRole, type AssignableRole } from '@/app/lib/roleChange';

/** How many accounts hold "admin" right now (paginates the admin user list). */
async function countAdmins(): Promise<number> {
  let count = 0;
  const perPage = 1000;
  for (let page = 1; page < 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data?.users ?? [];
    count += users.filter((u) => Array.isArray(u.app_metadata?.roles) && u.app_metadata.roles.includes('admin')).length;
    if (users.length < perPage) break;
  }
  return count;
}

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
  const ct = req.headers.get('content-type') || '';
  const isForm = !ct.includes('application/json');
  let targetRole: AssignableRole = 'admin';
  let enable: boolean | null = null;
  let returnTo: string | null = null;

  if (!isForm) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (isAssignableRole(body.role)) targetRole = body.role;
    // Back-compat: { admin: boolean } still toggles the admin role.
    if ('admin' in body) { targetRole = 'admin'; enable = !!body.admin; }
    else if ('enabled' in body) { enable = !!body.enabled; }
  } else {
    const form = await req.formData();
    const formRole = form.get('role');
    if (isAssignableRole(formRole)) targetRole = formRole;
    enable = form.has('enabled');                 // checkbox present → grant
    returnTo = String(form.get('returnTo') || '');
  }
  if (enable === null) return NextResponse.json({ error: 'invalid payload' }, { status: 400 });

  // Form posts (the checkboxes on /dashboard/users) get sent back to the list
  // with the reason; programmatic callers get JSON.
  const backTo = safeNextUrl(returnTo ?? '', '/dashboard/users');
  const fail = (status: number, message: string) => {
    if (!isForm) return NextResponse.json({ error: message }, { status });
    const url = new URL(backTo, req.url);
    url.searchParams.set('error', message);
    return NextResponse.redirect(url, { status: 303 });
  };

  // 4) Get current roles for target user
  const { data: target, error: getErr } = await supabaseAdmin.auth.admin.getUserById(id);
  if (getErr || !target?.user) {
    return NextResponse.json({ error: getErr?.message || 'user not found' }, { status: 404 });
  }

  const currentRoles: string[] = Array.isArray(target.user.app_metadata?.roles)
    ? (target.user.app_metadata!.roles as string[])
    : [];

  // 4b) The rules (lib/roleChange.ts, unit-tested): only admins, never their
  //     own roles, never the last admin. The admin count is fetched only when a
  //     revoke could hit that last rule.
  const revokingAdmin = targetRole === 'admin' && !enable && currentRoles.includes('admin');
  const decision = decideRoleChange({
    callerId: caller.id,
    callerRoles,
    targetId: id,
    targetRoles: currentRoles,
    role: targetRole,
    enable,
    adminCount: revokingAdmin ? await countAdmins() : undefined,
  });
  if (!decision.ok) return fail(decision.status, decision.message);
  const { newRoles } = decision;

  // 5) Persist roles (skip the GoTrue round-trip when nothing changes)
  if (decision.changed) {
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(id, {
      app_metadata: { roles: newRoles },
    });
    if (updateErr) return fail(400, updateErr.message);
  }

  // Role changes go through GoTrue, not PostgREST, so the row trigger cannot
  // name the caller — record the before/after here (the auth.users trigger in
  // migrations/add-audit-log.sql stays as the unattributed backstop).
  if (decision.changed) {
    const targetEmail = target.user.email ?? id;
    await logAdminAction({
      action: enable ? 'role.grant' : 'role.revoke',
      table: 'auth.users',
      recordId: id,
      summary: enable
        ? `Δόθηκε ο ρόλος "${targetRole}" στον χρήστη ${targetEmail}`
        : `Αφαιρέθηκε ο ρόλος "${targetRole}" από τον χρήστη ${targetEmail}`,
      meta: {
        target_user_id: id,
        target_email: target.user.email ?? null,
        role: targetRole,
        roles_before: currentRoles,
        roles_after: newRoles,
      },
      actor: { id: caller.id, email: caller.email },
    });
  }

  // 6) Redirect for form posts; JSON for programmatic calls
  if (isForm) {
    return NextResponse.redirect(new URL(backTo, req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, roles: newRoles, changed: decision.changed });
}
