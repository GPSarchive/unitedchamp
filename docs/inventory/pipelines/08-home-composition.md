# Pipeline 08 — Home page composition

**One-line summary:** The home page (`/`) is an ISR-cached, server-rendered editorial layout that fans out to four data queries and ~10 component subtrees. `/preview/home-c` exists as a parallel preview with a near-identical fetch path.

---

## Routes

- `/` ([page.tsx](../../../src/app/page.tsx)) — `revalidate: 300`
- `/preview/home-c` ([page.tsx](../../../src/app/preview/home-c/page.tsx)) — preview route, identical fetchers, different component set
- `/home`, `/hometest/home` — both redirect to `/`
- `/hometest` — older variant with debug logging (see [dead-ends.md](../dead-ends.md))

## Data fetched (in `Promise.all`)

| Function | Source | Notes |
|---|---|---|
| `fetchMatchesWithTeams()` | `matches` table, joins `teams`, `tournaments` | Window: -60d to +90d |
| `fetchTournaments()` | `tournaments` + counts | Limit 6, signed logos |
| `fetchRecentNewsCount()` | `announcements` + `articles` | Last 2 days, `react.cache()` |
| `fetchVideoMatches()` | `matches.video_url IS NOT NULL` | Limit 20 |

**These exact fetchers exist in both `/page.tsx` and `/preview/home-c/page.tsx`** — copy-paste, ~200 lines of duplication.

## Sections rendered (live `/`)

| Section | Component(s) | Background |
|---|---|---|
| Hero carousel | `HomeHero` | Carousel images |
| Welcome | `VantaSection` (animated bg) | Vanta |
| Dashboard + Calendar | `EditorialTeamDashboard`, `EditorialCalendar` | `GridBgSection` red/purple glow |
| Articles | `HomeArticles` | `PaperBgSection` (defined inline) |
| Videos | `HomeVideos` | `GridBgSection` |
| Top players | `EditorialTopPlayersSection` | `PaperBgSection` |
| Features | (3 cards inline) | `GridBgSection` |
| Tournaments CTA | `EditorialTournamentsGrid` | `PaperBgSection` |
| Testimonials | (3 inline figures) | `GridBgSection` |
| Floating bubble | `LeftSideBubbles` | — |

## Sections in `/preview/home-c` (where they diverge)

Uses the **classic** components instead of `Editorial*`:
- `TeamDashboard` (classic) instead of `EditorialTeamDashboard`
- `EnhancedMobileCalendar` instead of `EditorialCalendar`
- `TopPlayersSection` (classic) instead of `EditorialTopPlayersSection`
- `RecentAnnouncementsBubble` instead of `LeftSideBubbles`

Tournaments CTA uses the same `EditorialTournamentsGrid` (re-exported locally in `preview/home-c/`).

## Lib / utilities

- [`lib/fetchRecentNewsCount.ts`](../../../src/app/lib/fetchRecentNewsCount.ts) — the only fetcher not duplicated
- [`tournaments/signTournamentLogos.ts`](../../../src/app/tournaments/signTournamentLogos.ts)
- [`lib/image-config.ts`](../../../src/app/lib/image-config.ts) — `resolveImageUrl`
- Date helpers (`parseIsoPreserveClock`, `toNaiveIso`, `addMinutesNaive`, `partsToIso`) — **also duplicated** between the two pages
- Fonts: Fraunces, Archivo Black, JetBrains Mono, Figtree

## Known issues

1. **~200 lines of duplication** between `/` and `/preview/home-c`. Extract to `home/dataFetchers.ts` + `lib/dateHelpers.ts`.
2. **Inline `PaperBgSection` component** duplicated in both pages — should be in `home/PaperBgSection.tsx`.
3. **Classic component set lives on for `/preview/home-c`.** Once the preview is shipped or killed, drop the classics (see [cleanup-candidates.md](../cleanup-candidates.md) item 8).
4. **Hardcoded testimonials** in both pages — move to config.
5. **Hardcoded "Features" cards** in both pages — same.
6. **Carousel image paths hardcoded** (`/carousel0.jpg`, etc.).
7. **`fetchVideoMatches` returns first 20 unconditionally** — paginate or limit by date if the corpus grows.
