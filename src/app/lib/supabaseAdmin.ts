// lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false, // Disable for server-side only
      persistSession: false,    // No session persistence needed
      detectSessionInUrl: false // Not applicable server-side
    }
  }
);