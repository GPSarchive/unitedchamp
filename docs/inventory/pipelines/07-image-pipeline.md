# Pipeline 07 — Image / storage

**One-line summary:** All images live in Supabase Storage. Public images go via a proxy route; private ones use signed URLs. There's a hardcoded bucket name (`GPSarchive's Project`) used in many places, and an `image-config.ts` toggle for public-vs-private mode.

---

## Buckets

| Bucket | Default in code | Purpose |
|---|---|---|
| `GPSarchive's Project` | Hardcoded everywhere | Team logos, tournament assets, articles. **Has literal apostrophe + space in name.** |
| `team-logos` | `/dashboard/teams/page.tsx` | Possibly redundant with above |
| `players` | env `NEXT_PUBLIC_PLAYER_PHOTO_BUCKET` | Player photos |
| `assets` (with `masks/` prefix) | env `NEXT_PUBLIC_MASK_BUCKET` | SVG/PNG masks |

## API endpoints

### Read (proxy / signed URLs)
- `GET /api/public/team-logo/[...path]` — public passthrough for team logos
- `GET /api/storage/sign` — admin signed URL (1h)
- `GET /api/storage` — duplicate of above
- `GET /api/storage/proxy` — SSRF-safe image proxy (user auth required, restricts hostname to Supabase URL or `NEXT_PUBLIC_CDN_DOMAIN`)
- `GET /api/storage/player-img?path=...` — proxies player photos out of private bucket
- `GET /api/storage/mask?path=...` — proxies masks
- `GET /api/storage/tournament-img-loader?...` — resolves tournament image references

### Write
- `POST /api/storage/signed-upload` — presigned upload URL
- `POST /api/storage/article-img` — presigned upload for article images
- `POST /api/storage/tournaments/image-upload` — presigned upload for tournament logos/banners
- `POST /api/teams/logo-upload` — multipart upload (3MB max)
- `POST /api/teams/[id]/trim-logo` — re-uploads with `sharp` trim
- `POST /api/storage/delete-object` — delete by `{bucket, path}`

## Lib / utilities

| File | Purpose |
|---|---|
| [`lib/image-config.ts`](../../../src/app/lib/image-config.ts) | Central URL resolver. `USE_PUBLIC_BUCKET = true`. Optional `NEXT_PUBLIC_CDN_DOMAIN`. Defines `ImageType` enum. |
| [`lib/OptimizedImage.tsx`](../../../src/app/lib/OptimizedImage.tsx) | Wrapper component for tournament/team/player images |
| [`lib/player-images.ts`](../../../src/app/lib/player-images.ts) | **Deprecated** — `resolvePlayerPhotoUrl` |
| [`lib/colorExtraction.ts`](../../../src/app/lib/colorExtraction.ts) | Client-side Canvas color extraction for team logos |
| [`lib/utils/images.ts`](../../../src/app/lib/utils/images.ts) | `safeImageSrc`, `parseStoragePath` |
| [`lib/player-images.ts`](../../../src/app/lib/player-images.ts) | URL helper (deprecated) |
| [`paiktes/SignedImg.tsx`](../../../src/app/paiktes/SignedImg.tsx) | Client component that signs on demand |
| [`tournaments/signTournamentLogos.ts`](../../../src/app/tournaments/signTournamentLogos.ts) | Bulk-sign tournament logos |

## Known issues

1. **Bucket name `"GPSarchive's Project"` is hardcoded in ~10 files.** Single env var with default.
2. **`/api/storage` and `/api/storage/sign` are identical.** Delete one.
3. **Two upload paths for team logos** — `/api/teams/logo-upload` vs `/api/storage/signed-upload`.
4. **`USE_PUBLIC_BUCKET` is a code-level toggle** in `image-config.ts`. Should be an env var if you ever want per-env behavior.
5. **`sharp` for trim** — heavy native dep; only used in one endpoint.
6. **`team-logos` bucket reference** in dashboard teams page — confirm whether it's actually a separate bucket or a typo for the main one.
7. **`OptimizedImage` vs `player-images.ts` migration** is incomplete — finish or document.
