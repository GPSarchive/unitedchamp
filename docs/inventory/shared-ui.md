# Shared UI catalog

There are two flavors of UI files:

1. **Truly shared** — `src/components/` and `src/app/dashboard/ui/` — used across multiple routes.
2. **Route-local** — components colocated with the page that uses them (e.g. `src/app/OMADA/[id]/PlayersGrid.tsx`). These aren't shared, but they're worth inventorying so we can spot duplicates between routes.

This catalog focuses on group #1 in depth and group #2 by route-folder summary. See [00-overview.md](00-overview.md) for vocabulary.

---

## Truly shared (`src/components/`)

| Component | Used by | Notes |
|---|---|---|
| [AnnouncementContent.tsx](../../src/components/AnnouncementContent.tsx) | `/announcement/[id]` | Renders announcement body (md/html/plain). |
| [ArticleNavigation.tsx](../../src/components/ArticleNavigation.tsx) | `/article/[slug]` | Prev/next article navigation. |
| [ArticlePreview.tsx](../../src/components/ArticlePreview.tsx) | (unverified — flag) | Card-style article preview. Confirm consumers when tracing the article pipeline. |
| [RelatedArticles.tsx](../../src/components/RelatedArticles.tsx) | `/article/[slug]` | Related articles list. |
| [RichTextEditor.tsx](../../src/components/RichTextEditor.tsx) | Dashboard articles/announcements admins (inferred) | TipTap editor wrapper. |
| [TeamFilter.tsx](../../src/components/TeamFilter.tsx) | (unverified — flag) | Confirm consumers; may be route-local that was moved. |
| [FormerPlayerBadge.tsx](../../src/components/FormerPlayerBadge.tsx) | Team / player views | Badge for retired/former players. |
| [CardSwap.tsx](../../src/components/CardSwap.tsx) | (unverified — flag) | Sounds like an animation primitive. |
| [DotGrid.jsx](../../src/components/DotGrid.jsx) + [DotGrid.css](../../src/components/DotGrid.css) | `/dotgrid` demo | **Likely dead** — there's also a `src/app/OMADES/DotGrid.tsx` (newer, TSX) that's actually used. The `.jsx` version may be the stale original. |
| [Waves.tsx](../../src/components/Waves.tsx) + [Waves.css](../../src/components/Waves.css) | `/waves` demo only | **Likely dead** — only the standalone demo route consumes it. |
| **cards/** | | Stat-card primitives. |
| - [ScorerCard](../../src/components/cards/ScorerCard.tsx), [AssisterCard](../../src/components/cards/AssisterCard.tsx), [MvpCard](../../src/components/cards/MvpCard.tsx), [BestGkCard](../../src/components/cards/BestGkCard.tsx) | Home `EditorialTopPlayers`, `/paiktes` (likely) | Top-N player highlight cards. |
| - [types.ts](../../src/components/cards/types.ts), [index.ts](../../src/components/cards/index.ts) | (barrel) | Shared types + barrel export. |

### Dashboard shell

| Component | Used by | Notes |
|---|---|---|
| [ClientShell.tsx](../../src/app/dashboard/ui/ClientShell.tsx) | `dashboard/layout.tsx` | Sidebar + nav for the admin section. |

---

## Route-local components

Grouped by feature folder. These exist only inside their route's directory, but several look duplicated across routes.

### `src/app/home/` — homepage section components

The dominant pattern: every section has a "classic" variant + an "Editorial" variant (the redesign). Routes pick which set they use.

| Group | Files |
|---|---|
| **Hero & atmosphere** | `HomeHero.tsx`, `Carousel.tsx`, `VantaSection.tsx`, `GridBgSection.tsx`, `StaticDotGrid.tsx` |
| **Calendar** | `Calendar.tsx`, `EditorialCalendar.tsx`, `EnhancedMobileCalendar.tsx`, `ResponsiveCalendar.tsx`, `EventPillShrimp.tsx` (+ `.module.css`), `MultiMatchCluster.tsx` (+ `.module.css`), `newEventPilll.tsx` (typo, likely dead) |
| **Team dashboard** | `TeamDashboard.tsx`, `EditorialTeamDashboard.tsx`, `TeamSection.tsx`, `RecentMatchesTabs.tsx` |
| **Top players** | `TopPlayersSection.tsx`, `EditorialTopPlayersSection.tsx`, `EditorialTopPlayers.tsx`, `TopScorers.tsx` |
| **Tournaments** | `TournamentsGrid.tsx`, `EditorialTournamentsGrid.tsx` |
| **Content** | `HomeArticles.tsx`, `HomeVideos.tsx`, `MiniAnnouncements.tsx`, `RecentAnnouncementsBubble.tsx`, `LeftSideBubbles.tsx`, `ContactBubble.tsx` |
| **Sub-cards** | `cards/EditorialPlayerCard.tsx`, `cards/MarqueeText.tsx` |
| **Utility hook** | `useLockBodyScroll.ts` |
| **Other** | `page.tsx` (the `/home` redirect) |

**Surfaced**:
- `newEventPilll.tsx` — typo + suspicious. Verify usage; likely a sketch.
- `EditorialTopPlayers.tsx` vs `EditorialTopPlayersSection.tsx` — two similarly named files. Confirm both are used or fold them.
- Classic/Editorial pairs (`Calendar` ↔ `EditorialCalendar`, `TeamDashboard` ↔ `EditorialTeamDashboard`, etc.) — once the redesign is canonical, the classics become dead.

### `src/app/OMADES/` — teams listing

`SearchBar.tsx`, `Pagination.tsx`, `TeamCard.tsx`, `TeamsGrid.tsx`, `DotGrid.tsx` (+ `.module.css`), `ColorBends.tsx`.

- `TeamsGrid.tsx` exists but the page imports `TeamCard` directly. **Flag for cleanup if `TeamsGrid.tsx` has no consumers.**
- `DotGrid.tsx` (TSX) here vs `src/components/DotGrid.jsx` (JSX) — likely the migrated version. Confirm intent.
- `ColorBends.tsx` — atmospheric/background. Verify usage.

### `src/app/OMADA/[id]/` — team detail

`TeamClient.tsx` (orchestrator), `TeamHeader.tsx`, `TeamMeta.tsx`, `TeamSidebar.tsx`, `TeamRosterShowcase.tsx`, `PlayersGrid.tsx`, `PlayersSection.tsx`, `MatchesSection.tsx`, `TeamMatchesTimeline.tsx`, `AvatarImage.tsx`, `react-bits/LightRays.tsx`, `types.ts`.

- Both `PlayersGrid.tsx` and `PlayersSection.tsx` exist; same for `MatchesSection.tsx` and `TeamMatchesTimeline.tsx`. Confirm whether they're both rendered or whether one supersedes the other.

### `src/app/paiktes/` — players listing

`PlayersClient.tsx` (orchestrator), `PlayersList.tsx`, `PlayersFilterHeader.tsx`, `PlayerProfileCard.tsx`, `ProfileCard.tsx`, `Sportybackground.tsx`, `GlossOverlay.tsx`, `Head.tsx`, `SignedImg.tsx`, `types.ts`.

- `ProfileCard.tsx` vs `PlayerProfileCard.tsx` — two cards. Likely one is the older variant.

### `src/app/matches/` and `src/app/matches/[id]/` — match listing + detail

Listing: `MatchesExplorer.tsx`, `MatchesExplorerMobile.tsx`.

Detail: an unusually large component set (~22 files). Highlights:

| Cluster | Files |
|---|---|
| **Layout pieces** | `WelcomeMessage.tsx`, `StadiumBg.tsx`, `ShinyText.tsx`, `LaurelWreath.tsx` |
| **Match header** | `TournamentHeader.tsx`, `TeamVersusScore.tsx`, `TeamBadge.tsx` |
| **Stats** | `StatsEditor.tsx` (admin), `MatchStats.tsx`, `StatIcons.tsx` |
| **Events** | `MatchEventsTimeline.tsx`, `MatchParticipantsShowcase.tsx` |
| **Rosters** | `TeamRostersDisplay.tsx`, `TeamPlayers.tsx` |
| **Standings** | `TournamentStandings.tsx` |
| **Admin** | `MatchAdminActions.tsx`, `MatchVideoAdminForm.tsx`, `AddPlayerToTeamLauncher.tsx`, `AddPlayerToTeamModal.tsx`, `FormDraftAutosave.tsx` |
| **Server** | `actions.ts`, `queries.ts`, `utils.ts` |

- `TeamBadge.tsx` here likely duplicates the team-logo pattern used elsewhere (dashboard `Logo.tsx`, OMADA `AvatarImage.tsx`). **Flag as consolidation candidate.**

### `src/app/tournaments/` and `[id]/v2*/` — tournament shells + bracket viewers

Big folder, lots of redesign drift:

| Cluster | Files |
|---|---|
| **Top-level clients** | `TournamentsClient.tsx`, `TournamentClient.tsx` (note: `tournaments` → `TournamentsClient`, but tournaments list uses `TournamentsClients` — see routes.md item) |
| **Per-tournament clients** | `[id]/v2/TournamentClientV2.tsx` (light), `[id]/v2-dark/TournamentClientV2Dark.tsx` (dark) |
| **Brackets** | `[id]/v2/KOBracketV2.tsx`, `[id]/v2-dark/KOBracketV2Dark.tsx`, `[id]/v2-dark/MobileShell.tsx` |
| **Stage views** | `GroupsStage.tsx`, `LeaugeStage.tsx` (**typo: should be "League"**), `stages/GroupsStage.tsx`, `stages/LeagueStage.tsx`, `stages/KnockoutStage.tsx` |
| **Stage subviews** | `stages/MatchCard.tsx`, `stages/MatchCarousel.tsx`, `stages/koStage/KOStageDisplay.tsx`, `stages/koStage/KOStageViewer.tsx`, `stages/koStage/KOStageViewer copy.tsx` (**literal "copy" suffix — definitely dead**), `stages/koStage/KoStageDisplayTest.tsx`, `stages/koStage/BracketBackground.tsx`, `stages/koStage/BracketLineStyles.tsx` |
| **Stats** | `PlayerStats.tsx`, `components/PlayerStatistics.tsx` (two locations) |
| **Other primitives** | `TeamCard.tsx`, `TournamentHeader.tsx`, `StageMatchesTabs.tsx`, `StageStandingsMiniPublic.tsx` |
| **Data hooks** | `useTournamentData.tsx`, `useTournamentData copy.tsx` (**dead**), `useStages.tsx` |
| **Misc** | `loadTournamentIntoStore.tsx`, `signTournamentLogos.ts`, `actions.ts`, `loading.tsx`, `TournamentDebug.tsx` (**probably debug-only**) |

**Multiple confirmed dead-end candidates in this folder** — collect for [dead-ends.md](dead-ends.md):

- `LeaugeStage.tsx` (typo'd duplicate of `stages/LeagueStage.tsx`)
- `useTournamentData copy.tsx`
- `stages/koStage/KOStageViewer copy.tsx`
- `stages/koStage/KoStageDisplayTest.tsx`
- `TournamentDebug.tsx`
- Possibly `GroupsStage.tsx` (vs `stages/GroupsStage.tsx`)

### `src/app/dashboard/` — admin UI

The biggest folder. Notable subgroupings:

| Cluster | Files |
|---|---|
| **Layout** | `layout.tsx`, `ui/ClientShell.tsx`, `page.tsx` |
| **Teams admin** | `AdminTeamsCRUD.tsx`, `AdminTeamsGridClient.tsx`, `TeamRowItem.tsx`, `TeamRowEditor.tsx`, `TeamDetailsPanel.tsx`, `PlayersPanel.tsx`, `AddPlayerToTeamModal.tsx`, `ConfirmLogoModal.tsx`, `Logo.tsx`, `TrimLogoButton.tsx`, `teamHelpers.ts` |
| **Players admin** | `AdminPlayersCRUD.tsx`, `PlayerBoard.tsx`, `PlayersGrid.tsx`, `PlayerCard.tsx`, `PlayersToolbar.tsx`, `PlayerEditorDrawer.tsx`, `PlayerPhoto.tsx`, `types.ts` |
| **Matches admin** | `MatchesDashboard.tsx`, `RowEditor.tsx`, `PostponeDialog.tsx` |
| **Users admin** | `UsersTable.tsx` |
| **Articles / announcements admin** | `ArticlesAdmin.tsx`, `AnnouncementsAdmin.tsx` |
| **Stats admin** | `fix-stats/StatsTable.tsx`, `fix-stats/ApplyFixButton.tsx`, `fix-stats/actions.ts`, `refresh-stats/RefreshButton.tsx`, `refresh-stats/actions.ts` |

### `src/app/dashboard/tournaments/TournamentCURD/` — the wizard (largest substack)

`TournamentWizard.tsx` orchestrates a multi-step editor across:

| Step | Folder / Files |
|---|---|
| **Basics** | `basics/TournamentBasicsForm.tsx` |
| **Teams** | `teams/TeamPicker.tsx` |
| **Stages** | `stages/StageList.tsx`, `stages/StageCard.tsx`, `stages/ConfirmDialog.tsx`, `stages/StageStandingsMini.tsx`, `stages/actions.ts`, `stages/groups/GroupsBoard.tsx`, `stages/groups/GroupIntakeBoard.tsx`, `stages/groups/GroupsConfigKOIntake.tsx`, `stages/leauge/KnockoutConfigFromLeague.tsx` (**typo: "leauge"**), `stages/KnockoutTree/...` (a sub-tree of bracket editor hooks + components) |
| **Preview** | `preview/InlineMatchPlanner.tsx`, `preview/ExpandedRowEditor.tsx`, `preview/MatchControlPanel.tsx`, `preview/KnockoutBuilder.tsx`, `preview/ModernKnockoutViewesr.tsx` (**typo: "Viewesr"**), `preview/MatchPlannerZ/...` (Z-suffix module — a newer variant?), `preview/updateMatchAction.ts`, `preview/Usematchupdate.ts`, `preview/actions.ts` |
| **Submit** | `submit/ReviewAndSubmit.tsx`, `submit/tournamentStore.ts`, `submit/loadSnapshotClient.ts` |
| **Shared** | `shared/ValidationSummary.tsx`, `util/Generators.ts`, `util/groupsSignature.ts`, `util/functions/{common,groupsIntake,knockoutAnyN,knockoutPowerOfTwo,roundRobin}.ts` |
| **Top-level** | `TournamentWizard.tsx`, `actions.ts`, `progression.ts` |

**Surfaced**:
- Folder name `TournamentCURD` is itself the typo (should be `CRUD`).
- `stages/leauge/` folder name typo.
- `preview/ModernKnockoutViewesr.tsx` typo.
- `preview/MatchPlannerZ/` — a "Z" subfolder is unusual. Possibly a versioned replacement; confirm whether the non-Z planner still exists.
- `preview/Usematchupdate.ts` vs `preview/updateMatchAction.ts` — two match-update helpers. Confirm both are used.

---

## Cross-cutting notes (cleanup surface)

1. **Typo-named files almost certainly dead** (collect for dead-ends.md):
   - `src/app/tournaments/LeaugeStage.tsx`
   - `src/app/tournaments/useTournamentData copy.tsx`
   - `src/app/tournaments/stages/koStage/KOStageViewer copy.tsx`
   - `src/app/tournaments/stages/koStage/KoStageDisplayTest.tsx`
   - `src/app/tournaments/TournamentDebug.tsx`
   - `src/app/home/newEventPilll.tsx`
   - `src/app/dashboard/tournaments/TournamentCURD/preview/ModernKnockoutViewesr.tsx`
   - `src/app/dashboard/tournaments/TournamentCURD/stages/leauge/` (folder name)

2. **Suspected unused demo components**:
   - `src/components/Waves.tsx` / `Waves.css` — only consumer is `/waves` demo route
   - `src/components/DotGrid.jsx` — likely superseded by `OMADES/DotGrid.tsx`

3. **Two-way redesign pairs** in `home/`: `Calendar` ↔ `EditorialCalendar`, `TeamDashboard` ↔ `EditorialTeamDashboard`, `TopPlayersSection` ↔ `EditorialTopPlayersSection`, `TournamentsGrid` ↔ `EditorialTournamentsGrid`. The "classic" set is only used by `/preview/home-c` and `/hometest`. Once `/preview/home-c` is retired, the classics become dead.

4. **Duplicate concept components** to consolidate:
   - Team logos: `dashboard/teams/Logo.tsx`, `OMADA/[id]/AvatarImage.tsx`, `matches/[id]/TeamBadge.tsx`
   - Player cards: `paiktes/ProfileCard.tsx` vs `PlayerProfileCard.tsx`; `home/cards/EditorialPlayerCard.tsx`; `dashboard/players/PlayerCard.tsx`
   - Match cards: `tournaments/stages/MatchCard.tsx`, plus inline match rows in dashboard

5. **Hooks scattered** instead of centralized: `src/app/home/useLockBodyScroll.ts`, `src/app/tournaments/useStages.tsx`, `src/app/tournaments/useTournamentData.tsx`, `src/app/dashboard/.../KnockoutTree/hooks/*`. A `src/lib/hooks/` directory would help.

Once we have the pipelines doc, we'll know exactly which of the duplicate components actually get rendered and which are orphans. The full kill-list lives in [dead-ends.md](dead-ends.md).
