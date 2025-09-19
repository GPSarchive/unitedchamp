// src/app/dashboard/UsersTable.tsx
import 'server-only';
import Link from 'next/link';
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin';

function fmt(ts?: string | null) {
  return ts ? new Date(ts).toLocaleString() : '—';
}
function primaryEmail(u: any): string {
  return (
    u?.email ??
    (u?.identities || [])
      .map((i: any) => i?.identity_data?.email)
      .find(Boolean) ??
    '—'
  );
}
function providers(u: any): string {
  const list = (u?.identities || []).map((i: any) => i?.provider).filter(Boolean);
  return [...new Set(list)].join(', ') || '—';
}

export default async function UsersTable({
  page = 1,
  perPage = 50,
  q = '',
}: {
  page?: number;
  perPage?: number;
  q?: string;
}) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
  if (error) {
    return <p style={{ color: 'crimson' }}>Failed to load users: {error.message}</p>;
  }

  let users = data?.users ?? [];
  const term = q.trim().toLowerCase();
  if (term) {
    users = users.filter((u: any) => primaryEmail(u).toLowerCase().includes(term));
  }

  const prevPage = page > 1 ? page - 1 : null;
  const nextPage = users.length === perPage ? page + 1 : null;
  const returnTo = `/dashboard?page=${page}${term ? `&q=${encodeURIComponent(term)}` : ''}`;

  return (
    <>
      <div style={{ overflowX: 'auto', marginTop: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Email</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Providers</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>User ID</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Created</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Last sign-in</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Email confirmed</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Roles</th>
              <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => {
              const roles = Array.isArray(u.app_metadata?.roles) ? (u.app_metadata!.roles as string[]) : [];
              const emailConfirmed = u.email_confirmed_at ?? u.confirmed_at;

              return (
                <tr key={u.id}>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{primaryEmail(u)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{providers(u)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8, fontFamily: 'monospace' }}>{u.id}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{fmt(u.created_at)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{fmt(u.last_sign_in_at)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>{fmt(emailConfirmed)}</td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                    {roles.length ? roles.join(', ') : 'none'}
                  </td>
                  <td style={{ borderBottom: '1px solid #eee', padding: 8 }}>
                    <form action={`/api/admin/users/${u.id}/roles`} method="POST" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input type="checkbox" name="admin" defaultChecked={roles.includes('admin')} />
                        <span>Admin</span>
                      </label>
                      <button type="submit">Save</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
        {prevPage && (
          <Link href={`/dashboard?page=${prevPage}${term ? `&q=${encodeURIComponent(term)}` : ''}`}>← Prev</Link>
        )}
        {nextPage && (
          <Link href={`/dashboard?page=${nextPage}${term ? `&q=${encodeURIComponent(term)}` : ''}`}>Next →</Link>
        )}
      </div>
    </>
  );
}
