import { createSupabaseRouteClient } from '@/app/lib/supabaseServer';

export async function POST() {
  const supabase = await createSupabaseRouteClient();
  await supabase.auth.refreshSession(); // rotates cookies if needed
  return new Response(null, { status: 204 });
}
