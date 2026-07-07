# Plan: Reduce visual render cost on `/paiktes`

> **Hand-off note:** This plan is self-contained for a fresh session. Read the *Context* section first, then *Files in play*, then work the *Tasks* in order. The live page is at `src/app/paiktes/`. **Do not break the existing look** — the goal is the same visuals at a fraction of the paint/JS cost, not a redesign.

## Context

`/paiktes` is a public, server-rendered (Next.js App Router, `revalidate = 300`) player directory. It renders a split layout: a paginated player **list** on the left (50 rows/page) and a **3D profile card** on the right (desktop) / full-screen sheet (mobile). It looks great but is heavy: multiple always-on infinite animations, stacked gradient/SVG/noise backdrops (some duplicated verbatim), a continuous `requestAnimationFrame` tilt loop, and a per-image canvas alpha-detection pass. None of this is virtualized.

**Stack facts (verified):**
- `framer-motion ^12` is installed and used heavily. `gsap`, `three`, `vanta`, `ogl`, `p5`, `animejs` are also present (other pages).
- **No list-virtualization library is installed** (`react-window` / `react-virtuoso` / `@tanstack/react-virtual` are all absent). If a task calls for virtualization, you must add a dependency — see Task 5, which is explicitly *optional / last*.
- Images go through `PlayerImage` → `OptimizedImage` (`src/app/lib/OptimizedImage.tsx`), which wraps `next/image`. When `animate` is not `false` it adds a spring `motion.div` with `whileHover`/`whileTap`. The list already passes `animate={false}` (good); the profile card does **not**.

**Preference on file placement (from project memory):** redesign/refactor work belongs in a preview route (`src/app/preview/<variant>/...`), never overwriting the live page directly. For *pure performance* edits that keep the visuals identical, editing in place is acceptable, BUT if any task changes appearance enough to need review, branch it into `src/app/preview/paiktes-perf/` and copy the files there first. **Confirm with the user which approach they want before editing the live files** if you're unsure.

## Files in play

| File | Role | Cost hotspots |
|---|---|---|
| `src/app/paiktes/PlayersClient.tsx` | Layout shell, header, pagination | `PaperBackground` (always-on, lines ~85-125); **right-panel backdrop** (lines ~536-575) and **mobile-detail backdrop** (lines ~413-441) are **near-identical duplicates** — 5 stacked `repeating-radial-gradient`s + animated mesh (`meshGradient` 20s infinite) + fractal-noise SVG |
| `src/app/paiktes/PlayersList.tsx` | The list + rows | Renders all 50 rows; each `PlayerRowItem` is `memo`'d (good). No virtualization. |
| `src/app/paiktes/ProfileCard.tsx` | 3D tilt card | Continuous `requestAnimationFrame` loop writing ~9 CSS vars/frame on pointermove (lines ~147-219); initial 1500ms animation on every mount; `deviceorientation` listener |
| `src/app/paiktes/Sportybackground.tsx` | Pitch/hex/etc. pattern behind card | Infinite `framer-motion` animation (`pitch` variant animates `--x`/`--y` forever, 8s loop) |
| `src/app/paiktes/GlossOverlay.tsx` | Specular sheen on player PNG | `useHasAlpha` draws each image to a `<canvas>` and reads `getImageData` (main-thread, per image); infinite sweep animation; 5 stacked blend layers |
| `src/app/paiktes/PlayerProfileCard.tsx` | Wraps `ProfileCard` + stats panel | Passes `enableTilt={true}`; mounts on every `active` player change |

## Where the cost actually comes from (prioritized)

1. **Duplicated heavy backdrop** rendered twice in the same component tree (desktop aside + mobile sheet). 5 `repeating-radial-gradient`s is a large paint area; the `meshGradient` animation runs forever even when off-screen / tab hidden.
2. **`meshGradient` + `SportyBackground` + `GlossOverlay` infinite loops** keep the compositor/main thread busy continuously, even when the card is idle and even on `prefers-reduced-motion` (the backdrop mesh does not check it).
3. **`GlossOverlay.useHasAlpha`** decodes + rasterizes every player image to canvas on the main thread to sample transparency. This runs each time `active` changes.
4. **`ProfileCard` tilt** writes 9 CSS custom properties per `pointermove` frame; cheap-ish but unthrottled, and the **initial 1.5s animation re-fires on every player switch**.
5. **List**: fine at 50 rows, but `top=N` (URL param) can request far more and there's no upper guard on render count.

## Tasks (do in order; each is independently shippable)

### Task 1 — De-duplicate the card backdrop into one component
Extract the desktop-aside backdrop (`PlayersClient.tsx` ~536-575) and the mobile-detail backdrop (~413-441) — they are the same gradient/mesh/noise stack — into a single `CardBackdrop` component (new file `src/app/paiktes/CardBackdrop.tsx`). Render it in both places. This is a pure refactor: **no visual change**, removes ~60 duplicated lines, single source of truth.
- Verify both desktop (≥1280px) and mobile detail views look unchanged.

### Task 2 — Gate the infinite animations on visibility + reduced-motion
The `meshGradient` mesh, `SportyBackground` animation, and `GlossOverlay` sweep should **not** run when:
- the user prefers reduced motion (`framer-motion`'s `useReducedMotion()` — already imported in `GlossOverlay`/`OptimizedImage`, follow that pattern), OR
- the card is not visible (tab hidden, or — on desktop — no `active` player; on mobile — sheet closed).

Concretely:
- Wrap the mesh-animation `<div>` (currently CSS `animation: meshGradient 20s ...`) so the animation is only applied when motion is allowed. With reduced motion, render the static gradient layers but drop the animated mesh + noise.
- Pass a `paused`/`animate` prop down to `SportyBackground` (it already accepts `animate`) and `GlossOverlay` (it already accepts `run`) and set it `false` when reduced-motion or not visible.
- Use the Page Visibility API (`document.visibilitychange`) to pause all three when the tab is hidden.

### Task 3 — Make the page-level `PaperBackground` cheaper / reduced-motion aware
`PaperBackground` (`PlayersClient.tsx` ~85-125) has two large blurred radial blobs + a grid SVG, always painted. It's static (no animation) so it's lower priority, but:
- Confirm it isn't repainting on every list scroll (it's `fixed`/`-z-10` so it shouldn't, but verify with DevTools "Paint flashing").
- Consider rendering the grid SVG as a CSS `background-image` data-URI instead of an inline `<svg><pattern>` if profiling shows it in the paint cost.

### Task 4 — Reduce `GlossOverlay` main-thread work
`useHasAlpha` rasterizes each player image to canvas to decide whether to show the gloss. Options, cheapest first:
- **Memoize across mounts**: cache the alpha result by resolved image URL in a module-level `Map` so switching back to a previously-viewed player doesn't re-decode.
- **Skip entirely when reduced-motion**: if motion is off, the sweep doesn't animate anyway — short-circuit `useHasAlpha` and don't mount the canvas pass.
- Confirm whether `disableIfOpaque` is even needed for the actual player PNGs; if they're reliably transparent PNGs, the canvas detection may be removable.

### Task 5 — Throttle / settle the tilt loop (and stop re-firing the intro)
In `ProfileCard.tsx`:
- The **initial 1500ms `createSmoothAnimation`** (lines ~336-342) re-runs every time the effect re-subscribes (i.e. on every `active` player change because the card remounts/props change). Gate it so it only plays once per card mount, not on every prop change. Check the effect dependency array (~352-360) — `handlePointerMove` etc. are stable via `useCallback`, but confirm `active` changes don't retrigger the intro.
- `pointermove` → `updateCardTransform` writes 9 CSS vars per event. Throttle to one write per animation frame (coalesce with a pending-rAF guard) instead of per-event.
- Respect `prefers-reduced-motion`: when set, render the card flat (no tilt listeners, no intro animation). `enableTilt={false}` already short-circuits the handlers — wire reduced-motion to force `enableTilt=false` from `PlayerProfileCard.tsx`.

### Task 6 (OPTIONAL, do last, requires a decision) — Guard / virtualize the list
At 50 rows the list is fine. Only pursue this if profiling the `top=N` path (e.g. `/paiktes?top=500&sort=goals`) shows jank.
- **Cheapest:** clamp the client-side `top` slice (`PlayersClient.tsx` ~352-354) to a sane max (e.g. 200) and document it, since the server already paginates to 50 by default.
- **If real virtualization is needed:** this adds a dependency. Recommend `@tanstack/react-virtual` (headless, ~no styling assumptions, works with the existing grid rows). **Ask the user before adding a dependency.** The list uses a CSS-grid-per-row layout (`GRID_TEMPLATE_MOBILE` + `GRID_TEMPLATE_DESKTOP` in `PlayersList.tsx`); virtualization must preserve the sticky header row (~249) and the alphabetical dividers (~111-119), which complicates fixed-height assumptions. Plan for variable row heights or render dividers as part of the row.

## How to measure (do this before and after)

1. `npm run dev`, open `/paiktes` and `/paiktes?tournament_id=<id>` in Chrome.
2. DevTools → Performance: record ~5s idle on the page with a player selected. Look at:
   - **Scripting** time during idle (should approach 0 after Task 2/5 — currently the infinite loops keep it busy).
   - **Rendering/Painting** during idle and during list scroll.
3. DevTools → Rendering → "Paint flashing" and "Frame Rendering Stats" (FPS meter). Idle FPS cost should drop after gating animations.
4. Toggle `prefers-reduced-motion` (DevTools → Rendering → "Emulate CSS prefers-reduced-motion") and confirm animations actually stop.
5. Lighthouse "Performance" on `/paiktes` before/after for a single headline number.

## Acceptance criteria

- [ ] Card backdrop exists in exactly one component, rendered in both desktop and mobile.
- [ ] With `prefers-reduced-motion: reduce`, no infinite animation runs (mesh, sporty bg, gloss sweep, tilt intro all static).
- [ ] When the browser tab is hidden, the infinite animations pause.
- [ ] Idle scripting time on the page (player selected, motion allowed) is materially lower in a Performance recording than baseline.
- [ ] No visual regression at the three breakpoints that matter here: `<640px` (mobile list + sheet), `640–1279px` (full header, single column), `≥1280px` (split layout with right card).
- [ ] `npx tsc --noEmit` is clean for `src/app/paiktes/**`.

## Out of scope / do NOT touch

- The data layer in `page.tsx` (queries, batching, stats). That's the *other* plan (`paiktes-filtering-logic.md`).
- The Greek/Latin search behavior.
- Adding new visual features. Same look, less cost.
