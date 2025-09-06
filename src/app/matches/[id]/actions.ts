//matches/[id]/actions.ts
'use server';

import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { revalidatePath } from "next/cache";

export async function saveAllStatsAction(formData: FormData) {
  const match_id = Number(formData.get('match_id'));

  type Row = {
    match_id: number; team_id: number; player_id: number;
    goals: number; assists: number; yellow_cards: number; red_cards: number; blue_cards: number;
    mvp: boolean; best_goalkeeper: boolean; _delete?: boolean;
  };

  const rows = new Map<string, Row>();
  const entryRe =
    /^players\[(\d+)\]\[(\d+)\]\[(team_id|player_id|goals|assists|yellow_cards|red_cards|blue_cards|_delete)\]$/;

  for (const [k, v] of formData.entries()) {
    const m = entryRe.exec(k);
    if (!m) continue;
    const teamId = Number(m[1]);
    const playerId = Number(m[2]);
    const field = m[3];
    const key = `${teamId}:${playerId}`;

    if (!rows.has(key)) {
      rows.set(key, {
        match_id,
        team_id: teamId,
        player_id: playerId,
        goals: 0,
        assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        blue_cards: 0,
        mvp: false,
        best_goalkeeper: false,
      });
    }
    const row = rows.get(key)!;
    const val = typeof v === 'string' ? v : (v as File).name;

    if (field === '_delete') {
      row._delete = val === 'true' || val === 'on' || val === '1';
    } else if (field === 'team_id' || field === 'player_id') {
      // already in key
    } else {
      const n = Number(val);
      (row as any)[field] = Number.isFinite(n) ? Math.max(0, n) : 0;
    }
  }

  const mvpPlayerId = Number(formData.get('mvp_player_id') ?? 0) || 0;
  const bestGkPlayerId = Number(formData.get('best_gk_player_id') ?? 0) || 0;

  const ensureRow = (playerId: number) => {
    if (!playerId) return;
    const key = [...rows.keys()].find(k => k.endsWith(`:${playerId}`));
    if (!key) return;
    return rows.get(key)!;
  };

  const mvpRow = ensureRow(mvpPlayerId);
  if (mvpRow) mvpRow.mvp = true;
  const gkRow = ensureRow(bestGkPlayerId);
  if (gkRow) gkRow.best_goalkeeper = true;

  const toDelete: number[] = [];
  const toUpsert: Row[] = [];
  for (const r of rows.values()) {
    if (r._delete) toDelete.push(r.player_id);
    else toUpsert.push(r);
  }

  if (toDelete.length) {
    const { error } = await supabaseAdmin
      .from('match_player_stats')
      .delete()
      .eq('match_id', match_id)
      .in('player_id', toDelete);
    if (error) throw error;
  }

  if (toUpsert.length) {
    const { error } = await supabaseAdmin
      .from('match_player_stats')
      .upsert(toUpsert, { onConflict: 'match_id,player_id' });
    if (error) throw error;
  }

  // DB triggers will keep totals in sync
  revalidatePath(`/matches/${match_id}`);
}
