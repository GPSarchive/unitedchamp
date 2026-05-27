# UnitedChamp / UltraChamp — Inventory

This folder is a living map of the codebase. It exists for two reasons:

1. **Documentation** — give a future reader (or a future you) a fast way to understand what's here without grepping for an hour.
2. **Cleanup** — surface dead ends, orphaned files, and refactor candidates as a byproduct of mapping.

## The six layers

Every file in this codebase belongs to one of six layers. Catalogs are organized accordingly.

| Layer | What it covers | File |
|---|---|---|
| **Routes** | Every URL the user can land on (`page.tsx`, `layout.tsx`, redirects, dynamic segments) | [routes.md](routes.md) |
| **API endpoints** | Every `route.ts` under `src/app/api/` and any server actions exposed to the network | [api.md](api.md) |
| **Pipelines** | End-to-end feature flows that cross layers (tournament creation, article publishing, stats refresh…) | [pipelines/](pipelines/) |
| **Data model** | Supabase tables, RPCs, derived caches, Sanity schemas — reconstructed from migrations + live queries | [data-model.md](data-model.md) |
| **Shared UI** | Reusable components in `src/components/` and `src/app/dashboard/ui/` | [shared-ui.md](shared-ui.md) |
| **Infra / lib** | Plumbing: Supabase clients, image config, search utils, auth helpers, middleware (`proxy.ts`) | [infra.md](infra.md) |

A single file may appear in multiple catalogs (e.g. a page is both a Route and a node in a Pipeline). Cross-links are kept in the pipeline docs, not duplicated.

## Working files

- [dead-ends.md](dead-ends.md) — orphaned files, unused exports, redundant duplicates. Populated as we go.
- [cleanup-candidates.md](cleanup-candidates.md) — refactor opportunities surfaced during the inventory (copy-pasted code, hardcoded values, unsafe casts).

## Conventions

- File paths are written as markdown links: `[src/app/page.tsx](../../src/app/page.tsx)`.
- Greek route segments (`OMADES`, `paiktes`, `epikoinonia`, `kanonismos`, `anakoinoseis`) are kept as-is in path notation; the English meaning is given in parentheses.
- "RSC" = React Server Component; "RCC" = React Client Component (`"use client"`).
- ISR cache hints are noted as `revalidate: <seconds>`; `dynamic = "force-dynamic"` means uncached/SSR every request.

## Status

| Layer | State |
|---|---|
| Routes | ✅ drafted 2026-05-27 |
| API endpoints | ✅ drafted 2026-05-27 |
| Data model | ✅ drafted 2026-05-27 |
| Shared UI | ✅ drafted 2026-05-27 |
| Infra / lib | ✅ drafted 2026-05-27 |
| Pipelines | ✅ drafted 2026-05-27 (10 features) |
| Dead ends | ✅ drafted 2026-05-27 |
| Cleanup candidates | ✅ drafted 2026-05-27 |

Next step: verify each [dead-ends.md](dead-ends.md) entry with grep before deleting. The catalogs are static snapshots — they decay as the code changes; treat them as "last known good" and update the relevant layer doc whenever you touch a file in that layer.
