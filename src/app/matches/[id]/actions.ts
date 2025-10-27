// src/app/matches/[id]/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseRouteClient } from '@/app/lib/supabase/supabaseServer';
import { progressAfterMatch } from '@/app/dashboard/tournaments/TournamentCURD/progression';

// at top of actions.ts
type RouteClient = Awaited<ReturnType<typeof createSupabaseRouteClient>>;

// keep the same body, but add the return type and return statement
async function assertAdmin(): Promise<RouteClient> {
  const supabase = await createSupabaseRouteClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');

  const roles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : [];
  if (!roles.includes('admin')) throw new Error('Forbidden');

  return supabase; // ← make sure this line exists
}

export async function saveAllStatsAction(formData: FormData) {
  const supabase = await assertAdmin();

  const match_id = Number(formData.get('match_id'));
  if (!Number.isFinite(match_id)) throw new Error('Bad match id');

  const referee = ((formData.get('referee') as string) ?? '').trim();
  const mvp_player_id = Number(formData.get('mvp_player_id') ?? 0) || null;
  const best_gk_player_id = Number(formData.get('best_gk_player_id') ?? 0) || null;

  // Parse → arrays (reuse your existing parsing logic but push to arrays instead of DB)
  const participants: any[] = [];
  const stats: any[] = [];

  const statsRe = /^players\[(\d+)\]\[(\d+)\]\[(team_id|player_id|goals|assists|yellow_cards|red_cards|blue_cards|position|is_captain|gk|_delete)\]$/;
  const partRe  = /^participants\[(\d+)\]\[(\d+)\]\[(played)\]$/;

  const S = new Map<string, any>();
  const P = new Map<string, any>();

  for (const [k, v] of formData.entries()) {
    const sv = typeof v === 'string' ? v : (v as File).name;

    let m = statsRe.exec(k);
    if (m) {
      const [_, t, p, f] = m;
      const key = `${t}:${p}`;
      if (!S.has(key)) S.set(key, { team_id: Number(t), player_id: Number(p) });
      const row = S.get(key);
      if (f === 'is_captain' || f === 'gk' || f === '_delete') row[f] = sv === 'true' || sv === 'on' || sv === '1';
      else if (f === 'position') row.position = (sv ?? '').trim() || null;
      else if (f !== 'team_id' && f !== 'player_id') row[f] = Math.max(0, Number(sv) || 0);
      continue;
    }

    m = partRe.exec(k);
    if (m) {
      const [_, t, p] = m;
      const key = `${t}:${p}`;
      if (!P.has(key)) P.set(key, { team_id: Number(t), player_id: Number(p), played: false });
      const row = P.get(key);
      row.played = sv === 'true' || sv === 'on' || sv === '1';
      continue;
    }
  }

  participants.push(...[...P.values()]);
  stats.push(...[...S.values()]);

  const { data, error } = await supabase.rpc('save_match_payload', {
    p_match_id: match_id,
    p_referee: referee,
    p_participants: participants,
    p_stats: stats,
    p_mvp_player_id: mvp_player_id,
    p_best_gk_player_id: best_gk_player_id,
  });
  if (error) throw error;

  if (data?.status === 'finished') {
    progressAfterMatch(match_id).catch(console.error);
  }

  revalidatePath(`/matches/${match_id}`);
}
