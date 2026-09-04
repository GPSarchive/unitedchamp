import type { MetadataRoute } from 'next'
import { supabaseAdmin } from '@/app/lib/supabase/supabaseAdmin'

export const revalidate = 3600 // regenerate every hour

const BASE = 'https://ultrachamp.gr'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${BASE}/tournaments`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/OMADES`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/matches`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/paiktes`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/geniki-katataxi`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/anakoinoseis`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/articles`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/kanonismos`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/epikoinonia`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  const [tournaments, teams, matches, announcements, articles, seasons] = await Promise.all([
    supabaseAdmin.from('tournaments').select('id, season, updated_at'),
    supabaseAdmin.from('teams').select('id, season_label, created_at').is('deleted_at', null),
    supabaseAdmin.from('matches').select('id, updated_at'),
    supabaseAdmin
      .from('announcements')
      .select('id, updated_at')
      .eq('status', 'published'),
    supabaseAdmin
      .from('articles')
      .select('slug, updated_at')
      .eq('status', 'published'),
    supabaseAdmin.from('seasons').select('label, status, archived_at'),
  ])

  const dynamicRoutes: MetadataRoute.Sitemap = []

  // Seasons: the archive hub and each season's pages. Archived seasons' rows
  // are listed under their /seasons URLs (their live URLs only redirect there).
  const archived = new Set<string>()
  dynamicRoutes.push({ url: `${BASE}/seasons`, changeFrequency: 'monthly', priority: 0.6 })
  for (const s of seasons.data ?? []) {
    const label = encodeURIComponent(s.label as string)
    const lastModified = s.archived_at ? new Date(s.archived_at) : undefined
    if (s.status === 'archived') archived.add(s.label as string)
    dynamicRoutes.push({ url: `${BASE}/seasons/${label}`, lastModified, changeFrequency: 'monthly', priority: 0.6 })
    dynamicRoutes.push({ url: `${BASE}/seasons/${label}/katataxi`, lastModified, changeFrequency: 'monthly', priority: 0.5 })
  }

  for (const t of tournaments.data ?? []) {
    const season = t.season as string | null
    const isArchived = !!season && archived.has(season)
    dynamicRoutes.push({
      url: isArchived
        ? `${BASE}/seasons/${encodeURIComponent(season!)}/tournaments/${t.id}`
        : `${BASE}/tournaments/${t.id}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : undefined,
      changeFrequency: isArchived ? 'monthly' : 'daily',
      priority: isArchived ? 0.5 : 0.8,
    })
  }

  for (const t of teams.data ?? []) {
    const season = t.season_label as string | null
    const isArchived = !!season && archived.has(season)
    dynamicRoutes.push({
      url: isArchived
        ? `${BASE}/seasons/${encodeURIComponent(season!)}/teams/${t.id}`
        : `${BASE}/OMADA/${t.id}`,
      lastModified: t.created_at ? new Date(t.created_at) : undefined,
      changeFrequency: isArchived ? 'monthly' : 'weekly',
      priority: isArchived ? 0.5 : 0.7,
    })
  }

  for (const m of matches.data ?? []) {
    dynamicRoutes.push({
      url: `${BASE}/matches/${m.id}`,
      lastModified: m.updated_at ? new Date(m.updated_at) : undefined,
      changeFrequency: 'daily',
      priority: 0.7,
    })
  }

  for (const a of announcements.data ?? []) {
    dynamicRoutes.push({
      url: `${BASE}/announcement/${a.id}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : undefined,
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  for (const a of articles.data ?? []) {
    dynamicRoutes.push({
      url: `${BASE}/article/${a.slug}`,
      lastModified: a.updated_at ? new Date(a.updated_at) : undefined,
      changeFrequency: 'monthly',
      priority: 0.6,
    })
  }

  return [...staticRoutes, ...dynamicRoutes]
}
