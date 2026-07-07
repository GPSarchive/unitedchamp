# Pipeline 10 — Cross-cutting infra

**One-line summary:** Middleware, rate limiting, consent + analytics, navbar/footer chrome, CSP, Vanta backgrounds. The plumbing every other feature depends on.

This isn't a feature in the user-facing sense — it's a pipeline only because the files cluster together and are easier to map as a group.

---

## Middleware

[`src/proxy.ts`](../../../src/proxy.ts):
- Generates CSP nonce, passes via `x-nonce` header
- Applies rate-limit tiers (global / endpoint / IP / API-write / daily / auth)
- Exempts known search + social crawlers
- Refreshes Supabase session via `@supabase/ssr` cookies
- `CSP_REPORT_ONLY=1` switches to report-only

**Note:** filename is unconventional — usually `middleware.ts`. Confirm wiring.

## Rate limiting

[`src/app/lib/rate-limit.ts`](../../../src/app/lib/rate-limit.ts) on Vercel KV (`@vercel/kv`).

Pre-configured tiers:
- Global: 100k / min
- Endpoint: 18k / min per route
- IP: 20k / min
- API write: 30 / min per IP per path
- Daily: 5k / day per IP
- Auth: 10 / min per IP (stricter)

Per-email rate limits (`checkLimit`):
- Sign-in attempts: 5 / 15min per email
- Confirmation resend: 3 / hour per email

Fails open if KV is unavailable. Disabled in development.

## Consent / analytics

| File | Role |
|---|---|
| [`lib/consent/ConsentProvider.tsx`](../../../src/app/lib/consent/ConsentProvider.tsx) | Top-level provider, localStorage-backed |
| [`lib/consent/use-consent.ts`](../../../src/app/lib/consent/use-consent.ts) | Hook + storage helpers, events |
| [`lib/consent/CookieBanner.tsx`](../../../src/app/lib/consent/CookieBanner.tsx) | Banner UI |
| [`lib/consent/ConsentGatedAnalytics.tsx`](../../../src/app/lib/consent/ConsentGatedAnalytics.tsx) | Dynamic-imports Vercel Analytics + Speed Insights only after consent |
| [`lib/consent/ConsentContext.ts`](../../../src/app/lib/consent/ConsentContext.ts) | React context |

Wired in [`app/layout.tsx`](../../../src/app/layout.tsx).

## Navbar & Footer

| File | Role |
|---|---|
| [`lib/Navbar/Navbar.tsx`](../../../src/app/lib/Navbar/Navbar.tsx) | RSC entry — fetches user + news count |
| [`lib/Navbar/NavbarClient.tsx`](../../../src/app/lib/Navbar/NavbarClient.tsx) | Client navbar with menus, mobile drawer |
| [`lib/Navbar/NavbarBG.tsx`](../../../src/app/lib/Navbar/NavbarBG.tsx) | Backdrop |
| [`lib/Footer/Footer.tsx`](../../../src/app/lib/Footer/Footer.tsx) | Footer — **hides itself on `/paiktes`** |

## Backgrounds / animations

| File | Used by |
|---|---|
| [`lib/VantaBg.tsx`](../../../src/app/lib/VantaBg.tsx) | `/login`, `/epikoinonia`, `/kanonismos` |
| [`home/VantaSection.tsx`](../../../src/app/home/VantaSection.tsx) | Home welcome section |
| [`home/GridBgSection.tsx`](../../../src/app/home/GridBgSection.tsx) | Home grid background sections |
| `home/StaticDotGrid.tsx`, `OMADES/DotGrid.tsx`, `components/DotGrid.jsx` | Multiple variants of dot-grid backgrounds |
| `home/cards/MarqueeText.tsx` | Marquee animation |
| `framermotion/useStagedHeader.ts` + `useStagedHeaderMotion.ts` | Scroll-aware header |

## Lib / utilities

| File | Role |
|---|---|
| [`lib/getBaseUrl.ts`](../../../src/app/lib/getBaseUrl.ts) | App origin from env or request |
| [`lib/csrf.ts`](../../../src/app/lib/csrf.ts) | CSRF tokens |
| [`lib/safe-redirect.ts`](../../../src/app/lib/safe-redirect.ts) | Open-redirect guard |
| [`lib/types.ts`](../../../src/app/lib/types.ts) | Shared types (300+ lines) |
| [`src/lib/utils.ts`](../../../src/lib/utils.ts) | shadcn `cn(...)` helper |

## Known issues

1. **Middleware filename** — `proxy.ts` should be `middleware.ts`.
2. **Vanta library** is heavy; used in multiple places. Big bundle impact — deliberate brand choice though.
3. **Three dot-grid implementations** (`OMADES/DotGrid.tsx`, `components/DotGrid.jsx`, `home/StaticDotGrid.tsx`) — consolidate.
4. **`lib/Navbar/vantatypes.ts`** is generic types in a Navbar folder — relocate.
5. **Footer hide-list** is hardcoded for `/paiktes`. If more full-screen routes appear, this becomes a list to maintain.
6. **Rate-limit `auth` tier** is 10/min per IP but per-email is 5/15min — clarify documentation around the two.
