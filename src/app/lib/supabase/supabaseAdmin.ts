// lib/supabaseAdmin.ts
import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { auditingFetch } from '@/app/lib/audit/fetch';

// Service-role client: bypasses RLS. Every MUTATING call it makes carries the
// x-audit-* headers of the current request (lib/audit/fetch.ts), so the
// audit_row_change() trigger can record WHICH admin was behind the write.
// Reads are untouched — a cached page that only reads stays static.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false, // Disable for server-side only
      persistSession: false,    // No session persistence needed
      detectSessionInUrl: false // Not applicable server-side
    },
    global: { fetch: auditingFetch },
  }
);
