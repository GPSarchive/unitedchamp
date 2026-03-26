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
    { url: `${BASE}/standings`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${BASE}/anakoinoseis`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/articles`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/kanonismos`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/epikoinonia`, changeFrequency: 'monthly', priority: 0.4 },
  ]

  const [tournaments, teams, matches, announcements, articles] = await Promise.all([
    supabaseAdmin.from('tournaments').select('id, updated_at'),
    supabaseAdmin.from('teams').select('id, created_at').is('deleted_at', null),
    supabaseAdmin.from('matches').select('id, updated_at'),
    supabaseAdmin
      .from('announcements')
      .select('id, updated_at')
      .eq('status', 'published'),
    supabaseAdmin
      .from('articles')
      .select('slug, updated_at')
      .eq('status', 'published'),
  ])

  const dynamicRoutes: MetadataRoute.Sitemap = []

  for (const t of tournaments.data ?? []) {
    dynamicRoutes.push({
      url: `${BASE}/tournaments/${t.id}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : undefined,
      changeFrequency: 'daily',
      priority: 0.8,
    })
  }

  for (const t of teams.data ?? []) {
    dynamicRoutes.push({
      url: `${BASE}/OMADA/${t.id}`,
      lastModified: t.created_at ? new Date(t.created_at) : undefined,
      changeFrequency: 'weekly',
      priority: 0.7,
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
