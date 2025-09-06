// app/admin/tournoua/new/actions.ts
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createSupabaseRouteClient } from '@/app/lib/supabaseServer';
import type { NewTournamentPayload } from '@/app/lib/types';
import { redirect } from 'next/navigation';

const PayloadSchema = z.object({
  tournament: z.object({
    name: z.string().min(2),
    slug: z.string().min(1).nullable().optional(),
    logo: z.string().url().nullable().optional(),
    season: z.string().nullable().optional(),
    status: z.enum(['scheduled','running','completed','archived']).optional(),
    format: z.enum(['league','groups','knockout','mixed']).optional(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
    winner_team_id: z.number().int().nullable().optional(),
  }),
  stages: z.array(z.object({
    name: z.string().min(1),
    kind: z.enum(['league','groups','knockout']),
    ordering: z.number().int().optional(),
    config: z.any().optional(),
    groups: z.array(z.object({ name: z.string().min(1) })).optional(),
  })).min(1),
  tournament_team_ids: z.array(z.number().int()).optional(),
});

export async function createTournamentAction(formData: FormData) {
  // Form sends a JSON string field named "payload"
  const payloadStr = String(formData.get('payload') ?? '');
  let payload: NewTournamentPayload;
  try {
    payload = PayloadSchema.parse(JSON.parse(payloadStr));
  } catch (e: any) {
    return { ok: false, error: 'Invalid data: ' + e.message };
  }

  const supa = await createSupabaseRouteClient();

  // OPTIONAL: admin gate (RLS)
  const { data: { user } } = await supa.auth.getUser();
  const roles = (user?.app_metadata as any)?.roles ?? [];
  if (!roles.includes('admin')) return { ok: false, error: 'Forbidden' };

  const { data, error } = await supa.rpc('create_tournament', { v_json: payload as any });
  if (error) return { ok: false, error: error.message };

  // Cache bust & redirect to the new tournament
  revalidatePath('/tournoua');
  const slug = data?.[0]?.tournament_slug ?? payload.tournament.slug;
  redirect(`/tournoua/${slug}`);
}
