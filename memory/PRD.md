# UltraChamp.gr UI Revamp - PRD

## Project Overview
Redesign and elevate the three core public-facing page groups of UltraChamp.gr — a Greek mini-football championship platform built on Next.js 15 + Supabase.

## Original Problem Statement
- Redesign OMADES (Teams), Matches, and Tournaments pages
- Achieve sports-premium aesthetic (ESPN meets Apple meets Greek football culture)
- Dark, cinematic, high-contrast design with gold/amber accents
- Implement meaningful micro-interactions and glassmorphic depth

## Tech Stack (Unchanged)
- Next.js 15 (App Router, Server Components)
- React 19 + TypeScript
- Tailwind CSS v4
- Framer Motion 12+
- Supabase (backend)
- Zustand (state management)

## Color Palette
- Primary Background: #09090B (zinc-950)
- Secondary Background: #18181B (zinc-900)
- Accent Primary: #FBBF24 (amber-400)
- Accent Secondary: #F59E0B (amber-500)
- Status Green: #22C55E
- Status Red: #EF4444
- Status Orange: #F97316

## What's Been Implemented (Session 1 - Feb 23, 2026)

### Priority: ΑΓΩΝΕΣ (Matches) Pages

#### New Shared Components Created:
1. `/src/components/ui/AnimatedHeroBg.tsx` - Cinematic animated gradient background (replaces VantaBg)
2. `/src/components/ui/animations.tsx` - Reusable animation components:
   - FadeUp (scroll-triggered reveals)
   - Counter (animated number count-up)
   - GlassCard (glassmorphic card)
   - StaggerContainer/StaggerItem
   - WordByWord (headline animation)
   - PulsingDot (live indicator)
3. `/src/components/ui/StatusBadge.tsx` - Match status badges (finished, scheduled, postponed, running)

#### Updated Pages:
1. `/src/app/matches/page.tsx` - Redesigned with:
   - New animated hero section with amber accents
   - "ΑΓΩΝΕΣ" section tag
   - "Πρόγραμμα & Αποτελέσματα" headline
   - Uses existing RecentMatchesTabs component

2. `/src/app/matches/[id]/page.tsx` - Updated with:
   - AnimatedHeroBg background
   - Enhanced TournamentHeader with matchday/round info

3. `/src/app/matches/[id]/TeamVersusScore.tsx` - Complete redesign:
   - Cinematic scoreboard with winner highlights
   - Animated score count-up
   - Trophy badge for winners
   - Scorers list with goal icons
   - Status badges integration

4. `/src/app/matches/[id]/TournamentHeader.tsx` - Redesigned:
   - Sticky mini-bar style
   - Tournament logo + name + matchday
   - Link to tournament page

5. `/src/app/matches/[id]/MatchParticipantsShowcase.tsx` - Redesigned:
   - Two-column team layout
   - Player cards with photos and numbers
   - Amber accent styling

6. `/src/app/matches/[id]/TournamentStandings.tsx` - Redesigned:
   - Sports-premium table design
   - Position badges (gold, silver, bronze)
   - Goal difference color coding
   - Mobile-responsive cards

7. `/src/app/matches/[id]/TeamRostersDisplay.tsx` - Redesigned:
   - Consistent styling with participants
   - Hover animations

### Environment Setup
- Created `.env.local` template for Supabase credentials

## Remaining Work (P0 - High Priority)

### Page Group 2: OMADES (Teams)
- [ ] /OMADES page hero section
- [ ] Team cards with portrait ratio (3/4 aspect)
- [ ] Search bar with amber focus state
- [ ] Pagination pill style

### Page Group 3: Tournaments
- [ ] /tournaments listing page
- [ ] /tournaments/[id] detail page
- [ ] Stages section redesign
- [ ] Player statistics table

## Backlog (P1/P2)

### P1 - Medium Priority
- [ ] Page transitions (AnimatePresence)
- [ ] Responsive breakpoint testing
- [ ] Performance optimization (lazy loading)

### P2 - Lower Priority
- [ ] Reduced motion media query support
- [ ] Custom scrollbar styling
- [ ] Loading skeleton animations

## User Personas
1. **Football Fans** - Want quick access to match results and standings
2. **Team Managers** - Need to manage team rosters and match data
3. **Tournament Admins** - Organize and manage tournament brackets

## Next Tasks
1. User needs to add Supabase credentials to `.env.local`
2. Continue with OMADES pages redesign
3. Complete Tournaments pages redesign
4. Final responsive testing pass
