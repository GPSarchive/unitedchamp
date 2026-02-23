PROJECT: UltraChamp.gr — OMADES, Matches & Tournament Pages Revamp
OVERVIEW

Redesign and elevate the three core public-facing page groups of UltraChamp.gr
— a Greek mini-football championship platform built on Next.js 15 + Supabase.

The current pages are functional but visually inconsistent: dark backgrounds
with loosely organized components, generic spacing, and minimal animation
polish. The goal is a cohesive, sports-premium aesthetic — think ESPN meets
Apple meets Greek football culture. Every page should feel alive, data-rich,
and immersive — like stepping into a stadium, not scrolling through a
spreadsheet.

The reference aesthetic: dark, cinematic, high-contrast — with strong
typographic hierarchy, gold/amber accents against deep blacks, meaningful
micro-interactions, and glassmorphic depth. NOT a template. NOT a dashboard.
Think broadcast-quality sports media.

EXISTING TECH STACK (STRICT — DO NOT CHANGE)

Next.js 15 (App Router, Server Components + "use client" where needed)
React 19 + TypeScript (Mandatory)
Tailwind CSS v4 (styling — @import "tailwindcss" syntax, @theme inline)
Framer Motion 12+ (ALL animations — already installed)
Supabase (backend — supabaseAdmin for SSR, supabaseClient for CSR)
Zustand (tournament state store — useTournamentData)
Lucide React + React Icons (iconography)
SWR (client-side data fetching where applicable)
next/font/google (font loading — Roboto Condensed, Ubuntu Condensed, Noto Sans)
Vanta.js (animated 3D backgrounds — VantaBg component)

EXISTING DATA MODELS (DO NOT ALTER SCHEMA)

Teams:      { id, name, logo, colour, created_at, am, season_score, deleted_at }
Players:    { id, first_name, last_name, photo, height_cm, position, birth_date, player_number }
Matches:    { id, match_date, status (scheduled|postponed|finished), team_a_score, team_b_score,
              winner_team_id, team_a_id, team_b_id, field, stage_id, group_id, matchday, round,
              tournament_id, referee, video_url }
Tournaments:{ id, name, slug, logo, season, status (scheduled|running|completed|archived),
              format (league|groups|knockout|mixed), start_date, end_date, winner_team_id }
Stages:     { id, tournament_id, name, kind (league|groups|knockout), ordering, config }
Standings:  { stage_id, group_id, team_id, played, won, drawn, lost, gf, ga, gd, points, rank }

MatchPlayerStats: { match_id, team_id, player_id, goals, assists, own_goals, yellow_cards,
                    red_cards, blue_cards, mvp, best_goalkeeper, player_number }

COLOR PALETTE (UNIFIED ACROSS ALL THREE PAGE GROUPS)

Primary Background:    #09090B  (zinc-950 — deep black, main bg)
Secondary Background:  #18181B  (zinc-900 — card bg, elevated surfaces)
Surface:               #27272A  (zinc-800 — modal bg, inner panels)
Border Default:        rgba(255, 255, 255, 0.10) (white/10 — card borders)
Border Hover:          rgba(255, 255, 255, 0.20) (white/20 — interactive border)
Border Active:         rgba(251, 191, 36, 0.60) (amber-400/60 — selected/winner state)

Accent Primary:        #FBBF24  (amber-400 — gold — scores, winner highlights, CTAs)
Accent Secondary:      #F59E0B  (amber-500 — secondary gold for gradients)
Accent Glow:           rgba(251, 191, 36, 0.35) (gold glow — box-shadows, hovers)

Status Green:          #22C55E  (green-500 — "finished", win indicators)
Status Red:            #EF4444  (red-500 — loss, red cards, errors)
Status Orange:         #F97316  (orange-500 — "postponed", warning states)
Status Blue:           #3B82F6  (blue-500 — blue cards, informational)

Text Primary:          #FFFFFF  (white — headings, team names)
Text Secondary:        rgba(255, 255, 255, 0.70) (white/70 — body copy, descriptions)
Text Muted:            rgba(255, 255, 255, 0.40) (white/40 — metadata, labels)

Usage rules:
- Background is always zinc-950 (#09090B) — never fully black #000
- Gold/amber is ONLY for: scores, winner states, active tabs, CTAs, star players
- All cards use glassmorphic treatment: bg-black/40 backdrop-blur-xl border border-white/10
- Text shadows on all text over Vanta/gradient backgrounds for readability
- Generous whitespace — sports luxury breathes, never cramped

TYPOGRAPHY (USE EXISTING FONT SETUP)

Font pairing (already loaded via next/font/google):
Headings/Display:  Roboto Condensed 700 — condensed, athletic feel
Body/UI:           Roboto Condensed 400 — clean, readable
Labels/Metadata:   Geist Mono (var(--font-geist-mono)) — for stats, dates, numbers

Type scale (define via Tailwind @theme):

Display:    clamp(48px, 6vw, 80px) / line-height 0.95 / letter-spacing -0.03em  (hero headlines)
H1:         clamp(36px, 5vw, 56px) / line-height 1.0 / letter-spacing -0.02em
H2:         clamp(28px, 4vw, 40px) / line-height 1.1 / letter-spacing -0.01em
H3:         clamp(20px, 3vw, 28px) / line-height 1.2
Body:       16px / line-height 1.6
Stat Number:48px+ / font-weight 900 / tabular-nums / letter-spacing -0.02em
Label:      11px / letter-spacing 0.14em / UPPERCASE / Geist Mono


================================================================================
PAGE GROUP 1: OMADES (TEAMS) — /OMADES + /OMADA/[id]
================================================================================

1A. TEAMS LISTING PAGE (/OMADES)
Route: /OMADES
Current state: Basic grid of square cards, ColorBends WebGL background, simple search.

HERO SECTION

Full-width header area, 30vh minimum height.
Background: Vanta.js "eco" mode (existing VantaBg component), with a
dark gradient overlay: linear-gradient(to bottom, transparent 40%, #09090B 100%).

Content (centered):
- Section tag: "ΟΜΑΔΕΣ" (Geist Mono 11px, amber-400, letter-spacing 0.2em, uppercase)
- Headline: "Όλες οι Ομάδες" (Roboto Condensed 700, Display size, white)
  Animation: words enter staggered — y: 40, opacity: 0 → y: 0, opacity: 1
  Duration: 0.6s per word, stagger: 0.1s, easing: [0.16, 1, 0.3, 1]
- Subtitle: "{count} ομάδες εγγεγραμμένες στο UltraChamp" (16px, white/70)
  Enters with: y: 20, opacity: 0 → y: 0, opacity: 1 (0.5s delay after headline)
- Team count animates up from 0 using Framer Motion useMotionValue + animate

SEARCH BAR — IMPLEMENT EXACTLY:

Position: centered below subtitle, max-width 560px, sticky on scroll (top: 80px).

Layout: rounded-2xl, bg-black/60 backdrop-blur-xl, border 1px solid white/10,
        padding 14px 20px. Flex row.
Left: magnifying glass icon (Lucide Search, 18px, white/40).
Input: placeholder "Αναζήτηση ομάδας..." (Roboto Condensed 16px, white/40 placeholder).
       On typing: text is white.
Right: if search term exists, X button to clear (white/40, hover: white).
On focus: border transitions to amber-400/40 + box-shadow: 0 0 0 3px rgba(251,191,36,0.15).
Debounce: 300ms before triggering URL searchParam update (existing behavior, keep it).

Animation on sticky: when the search bar becomes sticky, it gains a subtle
backdrop-blur increase and a bottom shadow: 0 20px 40px rgba(0,0,0,0.5).

TEAMS GRID — REDESIGNED:

Layout: CSS Grid, responsive columns.
Mobile (< 640px):   grid-cols-2, gap-3
Tablet (640-1024px): grid-cols-3, gap-4
Desktop (> 1024px):  grid-cols-4, gap-5
XL (> 1280px):       grid-cols-5, gap-6
2XL (> 1536px):      grid-cols-6, gap-6

Each team card — IMPLEMENT EXACTLY:

Container:
- aspect-[3/4] (portrait ratio, NOT square)
- rounded-2xl
- bg-gradient-to-br from-white/[0.06] to-white/[0.02]
- backdrop-blur-xl
- border border-white/[0.08]
- overflow-hidden
- group (for hover interactions)
- Cursor: pointer
- transition-all duration-300 ease-out

Card structure (flex-col):
┌──────────────────────┐
│                      │
│      TEAM LOGO       │  ← 65% of card height
│      (centered)      │
│                      │
├──────────────────────┤
│  Team Name           │  ← Bottom section
│  Season Score: XX    │
│                 →    │
└──────────────────────┘

Logo section (top 65%):
- Flex center both axes
- Logo: max-w-[70%] max-h-[70%] object-contain
- If no logo: circular gradient (from-amber-400 to-amber-600) with first letter
- Subtle radial gradient glow behind logo on hover:
  bg-[radial-gradient(circle,rgba(251,191,36,0.08)_0%,transparent_70%)]

Bottom section:
- bg-black/30 backdrop-blur-sm
- padding 12px 16px
- Team name: Roboto Condensed 500, 14px, white, line-clamp-2
- Season score: Geist Mono 11px, amber-400, "Score: {value}"
  (only show if season_score exists and > 0)
- Bottom-right: arrow icon (→), white/30, transitions to amber-400 on hover

Hover interactions (ALL via Framer Motion or Tailwind transitions):
- Card lifts: translateY(-8px) + scale(1.03)
- Border: white/[0.08] → amber-400/30
- Shadow: 0 20px 60px rgba(251,191,36,0.12), 0 8px 20px rgba(0,0,0,0.4)
- Logo: scale(1.08) with 0.4s ease
- A subtle shine sweep effect: a 45deg linear-gradient(transparent, white/[0.05], transparent)
  that translates across the card surface from left to right over 0.6s on hover

Scroll-triggered entrance: cards enter with y: 40, opacity: 0, scale: 0.95 →
y: 0, opacity: 1, scale: 1, staggered 0.03s per card (use Framer Motion
useInView with once: true, margin: "-50px").

Empty state (no results):
Centered message with search icon (48px, white/20), text "Δεν βρέθηκαν ομάδες
για «{search}»" (18px, white/60), suggestion: "Δοκιμάστε διαφορετικό όρο
αναζήτησης" (14px, white/40).

PAGINATION — REDESIGNED:

Centered below grid, pill-shaped container.
bg-black/40 backdrop-blur-xl border border-white/10 rounded-full px-2 py-2.

Layout: ← Prev | 1 2 3 ... N | Next →

Each page number: 36x36 circle, text-sm font-medium.
Default: bg-transparent text-white/60 hover:bg-white/10
Active: bg-amber-400 text-black font-bold shadow-[0_0_15px_rgba(251,191,36,0.4)]
Disabled arrows: opacity-30, pointer-events-none.

Transitions: amber fill scales from center outward (scale 0 → 1) on page change.


1B. SINGLE TEAM PAGE (/OMADA/[id])
Route: /OMADA/[id]
Current state: VantaBg background, TeamSidebar hero, TeamRosterShowcase grid,
              TeamMatchesTimeline with tabs.

TEAM HERO SECTION — REDESIGNED:

Full-width, min-height 40vh. Background: existing VantaBg (keep "eco" mode).
Dark gradient overlay at bottom for content readability.

Layout: CSS Grid, 12-column on desktop.

Cols 1-4: Team logo area
- Logo in a 200x200 container
- Circular clip with double-ring border: outer ring 3px amber-400/60,
  inner ring 2px white/20, 4px gap between them
- Behind logo: animated radial pulse (amber glow, opacity 0.15, scale 1→1.3→1,
  duration 3s, infinite, Framer Motion)
- Logo entrance: scale 0.8, opacity 0 → scale 1, opacity 1 (spring, stiffness 200)

Cols 5-12: Team info
- Badge: "ΠΡΟΦΙΛ ΟΜΑΔΑΣ" (Geist Mono, 10px, amber-400, bg-black/50 rounded-full
  border border-amber-400/30, px-4 py-1.5)
- Team name: Display size, Roboto Condensed 700, white
  Entrance: x: -30, opacity: 0 → x: 0, opacity: 1 (0.5s, delay 0.2s)
- AM number (if exists): pill badge "ΑΜ: {value}" (Geist Mono, white/80,
  bg-black/40, border white/10)

Stats row (3 items, horizontal on desktop, stacked on mobile):
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ Season Score │ │ Tournaments  │ │   Titles    │
│    value     │ │    value     │ │   value     │
└─────────────┘ └─────────────┘ └─────────────┘

Each stat card:
- bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-6 py-4
- Label: Geist Mono 10px uppercase tracking-widest white/50
- Value: Roboto Condensed 700, 32px, white
- If "Titles" > 0: value is amber-400, border becomes amber-400/40,
  subtle gold glow shadow

Stat value animation: useMotionValue + animate, count up from 0, triggered
by useInView (once: true). Duration: 1.5s, ease: [0.16, 1, 0.3, 1].

Tournament participation list:
- Below stats, collapsible section (Framer Motion AnimatePresence)
- Header: "Συμμετοχές σε Τουρνουά" with count badge
- Each tournament row: border-b border-white/5, hover: bg-white/5
  - Left: tournament name (white, 14px, truncate)
  - Right: season badge (pill, amber bg/20, amber text)
- Max-height 240px, custom scrollbar (thin, amber thumb)

Championship wins list (if wins > 0):
- Similar to tournament list but with golden treatment
- Each win row: border-l-2 border-amber-400, bg-amber-500/5
  - Trophy icon (FaTrophy, amber-400) + name + season badge


TEAM ROSTER SECTION — REDESIGNED:

Section heading: "Ρόστερ Ομάδας" with team player count badge.
Animation: heading enters with clipPath reveal (polygon wipe left→right).

Player cards — IMPLEMENT EXACTLY:

Grid: grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4

Each player card:
Container:
- aspect-[3/4]
- rounded-2xl overflow-hidden
- bg-gradient-to-b from-zinc-900 to-black
- border border-white/[0.08]
- group cursor-pointer
- transition-all duration-300

Structure:
┌──────────────────────┐
│                      │
│    PLAYER PHOTO      │  ← 70% height, object-cover, object-top
│    (with gradient    │
│     overlay at       │
│     bottom)          │
│ ┌──────────────┐     │
│ │ POSITION TAG │     │  ← Top-left, absolute
│ └──────────────┘     │
│                      │
│ ┌──────────────────┐ │
│ │ First Name       │ │  ← Bottom, over gradient
│ │ Last Name (bold) │ │
│ └──────────────────┘ │
├──────────────────────┤
│ Stats Panel          │  ← Bottom 30%, dark glass
│ ┌────┬────┬────┐     │
│ │ AG │ GL │ AS │     │
│ │ 12 │ 8  │ 5  │     │
│ └────┴────┴────┘     │
│ ┌─────────┬────────┐ │
│ │  MVP: 2 │ GK: 1  │ │
│ └─────────┴────────┘ │
└──────────────────────┘

Photo section:
- Image fills top area with object-cover object-top
- Gradient overlay: linear-gradient(to top, black 0%, transparent 50%)
- On hover: image scale 1.08 (0.5s ease)

Position tag (top-left, absolute):
- bg-black/70 backdrop-blur-md px-3 py-1 rounded-full
- border border-white/20
- Geist Mono 10px, white, uppercase, tracking-wider

Player name (bottom of photo area, absolute):
- First name: 14px, white/80
- Last name: 18px, white, font-bold
- Text shadow: 0 2px 8px rgba(0,0,0,0.9)

Stats panel:
- bg-gradient-to-b from-black/60 to-black/80 backdrop-blur-md
- Top divider: 1px gradient line (transparent → amber-400/30 → transparent)
- Stats row 1: AG (matches), GL (goals), AS (assists) — 3-column grid
- Stats row 2: MVP count, Best GK count — 2-column grid
- Each stat: value in 18px white font-bold, label in 9px white/40 uppercase
- If goals > 5: goal value turns amber-400
- If MVP > 0: MVP value turns amber-400 with subtle glow

Hover:
- Card lifts: y(-12px), scale(1.03)
- Border: white/[0.08] → amber-400/40
- Shadow: 0 20px 60px rgba(251,191,36,0.15)
- Photo zoom: scale(1.08)
- Stats panel: top divider goes from amber-400/30 → amber-400/80

Entrance animation: staggered (0.04s each), scale 0.9 → 1, opacity 0 → 1,
                    spring (stiffness 200, damping 18).

Standout player treatment: if MVP > 2 OR goals > 10, the card gets:
- A thin amber-400 top border (2px)
- A star icon in the top-right corner (amber-400, pulsing)


TEAM MATCHES TIMELINE — REDESIGNED:

Section heading: "Αγώνες Ομάδας" with total count badge.

Tab bar (Upcoming / Finished):
- Pill container: bg-black/50 backdrop-blur-xl rounded-xl p-1 border border-white/10
- Each tab: px-6 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider
- Active: bg-gradient-to-r from-amber-500 to-amber-600, text-black,
  shadow-[0_0_20px_rgba(251,191,36,0.4)]
- Inactive: text-white/60, hover: text-white, hover:bg-white/5
- Framer Motion layoutId="tab-indicator" for smooth sliding active state

Match list — IMPLEMENT EXACTLY:

Container: rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden.

Each match row:
Height: auto (min 88px).
Layout: flex items-center, 3-column on desktop.

┌────────────────────────────────────────────────────────┐
│ [MY LOGO] My Team    3 — 1    Opponent [OPP LOGO]     │
│ ────────────── ⏐ Κυριακή 15 Μαρ 2025 ⏐ ────────────  │
│                  Tournament Name                        │
│                  Αγωνιστική 5                           │
└────────────────────────────────────────────────────────┘

Left (my team): logo (48x48, rounded-full, ring-2 ring-amber-500/50) + name (font-bold, white)
Center: score display
  - Finished: "3 — 1" (font-black, 28px, white)
    - Winner's score: amber-400
    - Loser's score: white/50
  - Scheduled: "VS" badge (bg-gradient amber, rounded-lg, px-4 py-2, font-black, 22px)
  - Below: date (Geist Mono 12px, white/60) + tournament name + matchday
Right (opponent): name (font-bold, white) + logo (48x48)

Row hover: bg-white/[0.03], left border slides in (2px amber-400, scaleY 0→1 from center)
Entire row is a <Link> to /matches/{id}

Win indicator: if my team won, subtle green glow on the left edge
Loss indicator: if my team lost, subtle red tint on the left edge
Draw: neutral (no edge color)

Pagination: same pill style as teams page.

Entrance: rows stagger in, y: 20, opacity: 0 → y: 0, opacity: 1 (0.04s stagger).


================================================================================
PAGE GROUP 2: MATCHES — /matches + /matches/[id]
================================================================================

2A. MATCHES LISTING PAGE (/matches)
Route: /matches
Current state: Minimal — just a header and RecentMatchesTabs component.

PAGE HERO:

Same pattern as teams: Vanta background, dark overlay.
Tag: "ΑΓΩΝΕΣ" (Geist Mono, amber-400)
Headline: "Πρόγραμμα &\nΑποτελέσματα" (Display size, white, word-by-word entrance animation)
Subtitle: "Όλοι οι αγώνες του UltraChamp σε πραγματικό χρόνο" (white/70)

FILTER BAR (NEW — ADD THIS):

Sticky bar below hero (top: 80px), full width.
bg-black/60 backdrop-blur-xl border-b border-white/10.
Horizontal scrollable on mobile.

Filters:
1. Status tabs: "Όλοι" | "Επερχόμενοι" | "Ολοκληρωμένοι" | "Αναβληθέντες"
   Style: pill buttons, same as team matches tab bar
2. Tournament filter: dropdown select
   Style: bg-black/60, border white/10, rounded-xl, amber-400 on open
3. Date range: simple "Αυτή τη βδομάδα" | "Αυτόν τον μήνα" | "Όλοι" pills

MATCHES GRID:

Layout: 1 column (each match is a full-width card/row).
max-width: 900px, centered.

Each match card — Google Champions League match card style:

Container:
- rounded-xl bg-black/40 backdrop-blur-xl border border-white/10
- p-5
- hover: border-white/20, shadow-lg

Structure:
┌──────────────────────────────────────────────────────────────┐
│ Tournament Logo  Tournament Name     Season     Matchday 5  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  [LOGO]  Team A Name       2 — 1       Team B Name  [LOGO]  │
│                                                              │
│ ─────────────────────── separator ───────────────────────────│
│  📅 Κυρ 15/03/2025 18:00   │   📍 Γήπεδο Αθηνών            │
│  🏆 Status Badge                                             │
└──────────────────────────────────────────────────────────────┘

Top row: tournament context (logo 24x24 + name in 12px white/60 + season pill + matchday pill)
Center: teams + score (same visual language as team timeline rows but bigger: logos 56x56, score 36px)
Bottom: metadata row (date, venue, status badge)

Status badges:
- Finished:   bg-green-500/20 text-green-400 border border-green-500/30 "ΟΛΟΚΛΗΡΩΘΗΚΕ"
- Scheduled:  bg-amber-500/20 text-amber-400 border border-amber-500/30 "ΠΡΟΣΕΧΩΣ"
- Postponed:  bg-orange-500/20 text-orange-400 border border-orange-500/30 "ΑΝΑΒΛΗΘΗΚΕ"
- Running:    bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 + pulsing dot "LIVE"

Entrance: stagger 0.06s, y: 30 → y: 0, opacity: 0 → 1.

PAGINATION: same pill style.


2B. SINGLE MATCH PAGE (/matches/[id])
Route: /matches/[id]
Current state: VantaBg, TournamentHeader, TeamVersusScore, rosters/participants,
              video, standings, admin panel.

TOURNAMENT HEADER BAR:

Sticky mini-bar at top of content area (below navbar).
bg-black/60 backdrop-blur-xl border-b border-white/10.
Left: tournament logo (32x32) + tournament name (14px, white/70)
Right: matchday/round badge + date

MATCH SCOREBOARD — REDESIGN TeamVersusScore EXACTLY:

Full-width hero card, min-height 280px.
Background: radial-gradient from center:
  - If finished + has winner: gradient includes winner team's colour at 5% opacity
  - Default: radial-gradient(ellipse at center, zinc-900 0%, black 100%)
Border: border border-white/10 rounded-2xl
Shadow: 0 30px 80px rgba(0,0,0,0.5)

Layout (CSS Grid, 3 columns):

┌──────────────────────────────────────────────────────┐
│                                                      │
│  [TEAM A LOGO]            SCORE          [TEAM B]    │
│   120x120               3  —  1           120x120    │
│  rounded-2xl                             rounded-2xl │
│                                                      │
│   Team A Name                            Team B Name │
│                                                      │
│   ⚽ Player 1 (×2)                  ⚽ Player 3 (×1) │
│   ⚽ Player 2 (×1)                                   │
│                                                      │
│ ─────────────── match info ────────────────────────  │
│   ΟΛΟΚΛΗΡΩΘΗΚΕ  │  Κυρ 15/03/2025  │  Διαιτητής: X  │
└──────────────────────────────────────────────────────┘

Team logo containers:
- 120x120, rounded-2xl, bg-black/50, border-2
- Winner: border-amber-400, shadow-[0_0_30px_rgba(251,191,36,0.4)]
  + animated trophy badge (top-right, spring entrance, FaTrophy amber)
- Loser: border-white/20
- Logos: object-contain, padding 12px

Score display (center):
- If finished: two numbers, 72px font-black
  Winner score: amber-400 + text-shadow glow
  Loser score: white/50
  Separator "—" in white/30
  Score entrance: scale 0.5 → 1, spring (stiffness 200, damping 12)

- If scheduled: "VS" text, 56px, font-black, white/80
  With subtle pulsing opacity animation (0.6 → 1 → 0.6, 2s infinite)

- If postponed: "ΑΝΑΒΛΗΘΗΚΕ" badge (orange treatment)

Team names: below logos, 20px font-bold white, text-center.
Winner name: amber-400.

Scorers section (below each team, only if finished):
- Each scorer row: player name (13px, white/80) + goal icons (⚽ amber-400, repeated per goal)
- Own goals: "(αυτογκόλ)" label, white/50 text, muted icon color
- Entrance: stagger 0.1s, y: 10, opacity: 0 → y: 0, opacity: 1

Match info bar (bottom of card):
- Separated by thin vertical dividers (white/10)
- Status badge + date + referee name
- All in Geist Mono 12px

MATCH PARTICIPANTS SHOWCASE — REDESIGNED:

Two-column layout: Team A | Team B.
Each side has the team's header (logo + name) and player list below.

Section header:
- "Συμμετέχοντες Παίκτες" (H2, white, centered)
- "Team A vs Team B" subtitle (white/60)

Each team column:
- Header: team logo (40x40) + team name (18px, font-bold, white)
- Player list:
  Each player row:
  - Player photo (40x40 circle, object-cover) + name (14px, white) + number badge (#7, amber-400)
  - On hover: bg-white/5, player name → amber-400

If match is scheduled (no participants yet), show FULL ROSTERS instead:
- Same layout but with all rostered players
- Header says "Ρόστερ" instead of "Συμμετέχοντες"

MATCH VIDEO SECTION (keep existing, style upgrade):

- Rounded-2xl, border white/10, bg-black/40
- "Video Αγώνα" heading with play icon
- 16:9 iframe container with rounded-xl overflow-hidden

TOURNAMENT STANDINGS (contextual, below video):

- Only shows if match has a stage_id
- Same standings table design as tournament page (see below)
- Highlight current match's teams in the table (amber row bg)


================================================================================
PAGE GROUP 3: TOURNAMENTS — /tournaments + /tournaments/[id]
================================================================================

3A. TOURNAMENTS LISTING PAGE (/tournaments)
Route: /tournaments
Current state: Basic card grid, TournamentsClient component.

PAGE HERO:

Tag: "ΔΙΟΡΓΑΝΩΣΕΙΣ"
Headline: "Τουρνουά &\nΠρωταθλήματα" (word-by-word entrance)
Subtitle: "Παρακολούθησε τις διοργανώσεις του UltraChamp" (white/70)

TOURNAMENT GRID:

Layout: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6

Each tournament card — IMPLEMENT EXACTLY:

Container:
- rounded-2xl overflow-hidden
- bg-gradient-to-br from-white/[0.06] to-white/[0.02]
- backdrop-blur-xl border border-white/[0.08]
- group, cursor-pointer
- transition-all duration-300

Structure:
┌──────────────────────────────────────┐
│ [Status Badge]      [Format Badge]   │  ← Top row
│                                      │
│         [TOURNAMENT LOGO]            │  ← Center, 80x80
│          Tournament Name             │
│          Season 2024-25              │
│                                      │
│ ──────────── divider ─────────────── │
│                                      │
│  Teams: 16    │    Matches: 48       │  ← Stats row
│                                      │
│          View Tournament →           │  ← CTA
└──────────────────────────────────────┘

Top badges:
- Status: positioned top-left
  - Running: green dot (pulsing) + "Σε Εξέλιξη" (green treatment)
  - Completed: "Ολοκληρωμένο" (white/60)
  - Scheduled: "Προγραμματισμένο" (amber treatment)
- Format: positioned top-right
  - "LEAGUE" / "GROUPS" / "KNOCKOUT" / "MIXED"
  - Geist Mono 10px, white/60, bg-black/40, rounded-full

Logo: 80x80 center, rounded-full, ring-2 ring-white/20, bg-black/50
If no logo: first letter in 32px font-bold on amber gradient circle.

Name: H3 size, white, font-bold, text-center, max 2 lines
Season: Geist Mono 13px, white/60

Stats row: 2 columns, border-t border-white/[0.06]
Each: stat value (20px, white, font-bold) + label (11px, white/40, uppercase)

CTA row: "Δες το Τουρνουά →" (14px, amber-400, text-center)
On hover: → arrow shifts right 4px

Card hover:
- Lift: y(-8px), scale(1.02)
- Border: amber-400/20
- Shadow: 0 20px 60px rgba(251,191,36,0.1)
- Logo: scale(1.05)

Entrance: stagger 0.08s, y: 40, opacity: 0 → y: 0, opacity: 1.


3B. SINGLE TOURNAMENT PAGE (/tournaments/[id])
Route: /tournaments/[id]
Current state: TournamentClient with header, stages, player statistics.

TOURNAMENT HEADER — REDESIGNED:

Full-width hero card (not a small bar — a commanding header).
min-height: 200px. rounded-2xl.
Background: gradient that subtly uses the tournament's primary color if available,
otherwise: gradient from zinc-900 to black.
border border-white/10.

Layout: flex row on desktop, stacked on mobile.

Left side:
- Tournament logo: 100x100, rounded-2xl, bg-black/50, border-2 border-white/20
  - Running: border becomes emerald-400/60 with pulsing glow
- Tournament name: H1 size, font-extrabold, white
  Gradient text: bg-clip-text bg-gradient-to-r from-white to-amber-200
- Season: 18px, white/70
- Status badge (pill, same treatment as listing cards)

Right side: 3-stat counters (horizontal on desktop)
┌──────────┐ ┌──────────┐ ┌──────────┐
│  Teams   │ │  Stages  │ │ Matches  │
│    16    │ │    3     │ │   48     │
└──────────┘ └──────────┘ └──────────┘

Each counter:
- Value: 40px, font-bold, amber-400
- Label: 12px, white/70, uppercase
- Count-up animation on mount (useMotionValue, 1.5s)

STAGES SECTION — REDESIGNED:

Section heading: "Στάδια Τουρνουά" with stage count.

Each stage card:
- rounded-2xl border border-white/10 overflow-hidden
- Collapsible (click header to expand/collapse body)
- Framer Motion: AnimatePresence with height auto animation

Stage header:
- bg-gradient-to-r from-black/60 to-zinc-900/60 backdrop-blur-sm
- Left: stage number badge (40x40 rounded-xl, gradient amber → orange, white text, font-bold)
       + stage name (H3, white) + kind label (14px, white/70)
- Right: kind icon + "League" / "Όμιλοι" / "Νοκ-Άουτ" pill badge
- Chevron icon that rotates 180deg on collapse/expand

Stage content:

A) League stage:
- Standings table — IMPLEMENT EXACTLY:

Table container: rounded-xl overflow-hidden border border-white/[0.06]

Header row: bg-zinc-900/80, sticky
Columns: # | Ομάδα | ΑΓ | Ν | Ι | Η | ΓΥ | ΓΚ | ΔΤ | Β
All header cells: Geist Mono 10px uppercase tracking-wider white/40

Data rows:
- Alternating: odd rows bg-black/20, even bg-transparent
- Hover: bg-amber-500/[0.05]
- Rank column: font-bold
  - #1: amber-400 text + left border 3px amber-400
  - #2-3: white text + left border 3px white/30
  - Others: white/60
- Team cell: logo (32x32 rounded-full) + name (font-semibold white)
- Points column: font-bold text-lg amber-400
- Goal difference: green if positive, red if negative, white if 0
- All number cells: tabular-nums, Geist Mono 13px

Row entrance: stagger 0.03s, opacity 0 → 1

Below table: MatchCarousel for this stage (existing component, keep logic, restyle cards)

B) Groups stage:
- Each group in its own sub-card (rounded-xl border white/[0.06])
- Group name header: "ΟΜΙΛΟΣ Α" (Geist Mono uppercase, amber-400)
- Standings table per group (same design as league table, smaller)
- Matches for that group below

C) Knockout stage:
- Keep existing KOStageViewer bracket tree logic
- Style upgrade: bracket lines in amber-400/30, match nodes with same card style

MATCH CARDS (used in carousels within stages):

Each match card — smaller version of the matches listing card:
- rounded-xl bg-black/40 border border-white/[0.08] p-4
- Top: date + status badge
- Center: Team A logo (48x48) + score/VS + Team B logo (48x48)
- Team names below logos (12px, font-semibold)
- Hover: border-amber-400/30, shadow, lift
- Link to /matches/[db_id]

PLAYER STATISTICS SECTION — REDESIGNED:

Section heading: "Στατιστικά Παικτών"

Sortable table:
- Columns: # | Παίκτης | Ομάδα | ΑΓ | Γκολ | Ασίστ | MVP | Κίτρ. | Κόκ. | Μπλε
- Clickable column headers for sorting (click toggles asc/desc)
  Active sort column: amber-400 text + arrow indicator (▲/▼)
- Same table styling as standings table
- Player cell: photo (36x36 circle) + name (font-medium)
  If player has captain flag: small "C" badge
- Goals column if player is top scorer: amber-400 + star icon

Pagination: 15 players per page, same pill pagination.


================================================================================
GLOBAL ANIMATIONS REFERENCE
================================================================================

Page Transitions (between routes):
```typescript
// Wrap routes in AnimatePresence
// Each page:
// enter: opacity 0, y: 20 → opacity 1, y: 0  (0.4s, ease [0.16, 1, 0.3, 1])
// exit:  opacity 1, y: 0  → opacity 0, y: -20 (0.3s)
```

Scroll-triggered reveals (reusable component):
```typescript
const FadeUp = ({ children, delay = 0 }: { children: ReactNode; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
  >
    {children}
  </motion.div>
);
```

Card hover lift (reusable):
```typescript
// On every interactive card:
whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.25 } }}
```

Count-up animation (reusable):
```typescript
const Counter = ({ from = 0, to, suffix = "" }: { from?: number; to: number; suffix?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const count = useMotionValue(from);
  const rounded = useTransform(count, Math.round);
  const display = useMotionTemplate`${rounded}${suffix}`;

  useEffect(() => {
    if (isInView) {
      animate(count, to, { duration: 1.5, ease: [0.16, 1, 0.3, 1] });
    }
  }, [isInView]);

  return <motion.span ref={ref}>{display}</motion.span>;
};
```

Tab indicator animation:
```typescript
// Use Framer Motion layoutId for smooth tab indicator sliding:
{tabs.map((tab) => (
  <button key={tab.key} onClick={() => setActive(tab.key)} className="relative">
    {tab.label}
    {active === tab.key && (
      <motion.div
        layoutId="active-tab"
        className="absolute inset-0 bg-gradient-to-r from-amber-500 to-amber-600 rounded-lg"
        style={{ zIndex: -1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    )}
  </button>
))}
```

Image loading:
- All images use next/image where possible (existing <TeamImage>, <TournamentImage>)
- Blur placeholder → sharp transition
- Loading skeleton: bg-zinc-800 animate-pulse rounded-xl


================================================================================
RESPONSIVE BREAKPOINTS
================================================================================

Mobile (< 640px):
- Single column everything
- Font sizes: Display clamp to 48px min, H1 to 36px
- Cards: full width, reduced padding
- Scores: 48px instead of 72px
- Team logos in scoreboard: 80x80 instead of 120x120
- Stats: 2x2 grid instead of horizontal row
- Vanta background: reduce complexity (existing "eco" mode handles this)

Tablet (640–1024px):
- Teams grid: 3 columns
- Match cards: slightly compressed
- Tournament cards: 2 columns

Desktop (> 1024px):
- Full layout as described above

XL (> 1280px):
- Teams grid: 5 columns
- Max-width containers expand

2XL (> 1536px):
- Teams grid: 6 columns


================================================================================
PERFORMANCE REQUIREMENTS
================================================================================

- All images: next/image with explicit sizes prop, loading="lazy" except hero
- Fonts: already preloaded via next/font/google (keep as-is)
- Framer Motion: use lazy motion where possible
  ```typescript
  import { LazyMotion, domAnimation } from "framer-motion"
  // Wrap page content in <LazyMotion features={domAnimation}>
  ```
- No animation on elements not in viewport (useInView with once: true)
- Reduce motion: @media (prefers-reduced-motion: reduce) —
  disable all transform animations, keep only opacity transitions
- Server Components: keep data fetching in server components (existing pattern)
- Client components: only where interactivity is needed ("use client")
- Zustand store: keep existing useTournamentData store for tournament pages


================================================================================
IMPLEMENTATION ORDER
================================================================================

1. Create shared animation components (FadeUp, Counter, TabIndicator)
2. Create shared UI primitives (GlassCard, StatBadge, StatusPill, SectionHeading)
3. Revamp /OMADES page (hero, search, grid, pagination)
4. Revamp /OMADA/[id] page (hero, roster, matches timeline)
5. Revamp /matches page (hero, filters, match list)
6. Revamp /matches/[id] page (scoreboard, participants, video, standings)
7. Revamp /tournaments page (hero, grid)
8. Revamp /tournaments/[id] page (header, stages, standings tables, player stats)
9. Final responsive pass — test all breakpoints
10. Performance audit — lazy loading, bundle size, animation perf
