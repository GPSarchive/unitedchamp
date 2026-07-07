# Feature pipelines

This is where files get categorized by **feature** rather than by layer. Each file below traces one feature end-to-end: which routes serve it, which API endpoints back it, which tables it touches, which components render it.

If you want to know "what owns the tournament editor" or "where does article publishing live," start here.

## Feature index

| # | Feature | Doc |
|---|---|---|
| 01 | **Tournament lifecycle** — create, edit, save, snapshot, render | [01-tournament-lifecycle.md](01-tournament-lifecycle.md) |
| 02 | **Match lifecycle** — schedule, edit stats, postpone, finish, progress brackets | [02-match-lifecycle.md](02-match-lifecycle.md) |
| 03 | **Player stats pipeline** — match stats → caches → leaderboards | [03-player-stats.md](03-player-stats.md) |
| 04 | **Team management** — CRUD, soft delete, logo upload + trim, color extraction | [04-team-management.md](04-team-management.md) |
| 05 | **Content publishing** — articles + announcements (with TipTap, view counts) | [05-content-publishing.md](05-content-publishing.md) |
| 06 | **Authentication & authorization** — sign-in/up, OAuth, roles, sessions, CSRF | [06-auth-and-authorization.md](06-auth-and-authorization.md) |
| 07 | **Image / storage pipeline** — signed uploads, proxies, image config, masks | [07-image-pipeline.md](07-image-pipeline.md) |
| 08 | **Home page composition** — what data the home page assembles and from where | [08-home-composition.md](08-home-composition.md) |
| 09 | **Standings & progression** — stage standings, bracket advancement, reseed | [09-standings-progression.md](09-standings-progression.md) |
| 10 | **Cross-cutting infra** — middleware, rate limiting, consent, navbar/footer | [10-cross-cutting-infra.md](10-cross-cutting-infra.md) |

## How to read a pipeline doc

Each file follows the same shape:

1. **Summary** — one paragraph: what the feature does, who uses it.
2. **Routes (UI entry points)** — where users hit it.
3. **API endpoints** — server handlers it triggers.
4. **Server actions** — `"use server"` files (these aren't in the API catalog but matter for write flows).
5. **DB tables / RPCs touched** — the persistence surface.
6. **Components** — what renders the UI.
7. **Lib / utilities used** — supporting code.
8. **Known issues** — drift, dead branches, layering inversions, anything worth flagging.

## What this folder is NOT

- It's not a substitute for the layer catalogs ([routes.md](../routes.md), [api.md](../api.md), etc.). Those are exhaustive; these pipeline docs are curated narratives.
- It's not where dead-end findings get tracked (that's [dead-ends.md](../dead-ends.md)) — though pipelines surface a lot of them.

---

**Status:** As of 2026-05-27, the inventory pass is fresh. These pipeline docs are sketched at a high level. Deepen any individual one when you next touch its area.
