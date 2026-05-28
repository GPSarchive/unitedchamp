# Pipeline 05 — Content publishing

**One-line summary:** Two parallel content systems coexist: long-form **articles** (rich TipTap JSON, slug-based URLs, draft → published workflow) and short-form **announcements** (markdown/html/plain, ID-based URLs, with scheduled visibility windows).

---

## Routes

### Public
- `/articles` ([page.tsx](../../../src/app/articles/page.tsx)) — unified feed (client component, fetches from API)
- `/article/[slug]` ([page.tsx](../../../src/app/article/[slug]/page.tsx)) — single article
- `/announcement/[id]` ([page.tsx](../../../src/app/announcement/[id]/page.tsx)) — single announcement
- `/anakoinoseis` — redirect → `/articles` (legacy URL)
- `/` — home embeds `HomeArticles` and `LeftSideBubbles` (news count)

### Admin
- `/dashboard/articles` ([page.tsx](../../../src/app/dashboard/articles/page.tsx))
- `/dashboard/announcements` ([page.tsx](../../../src/app/dashboard/announcements/page.tsx))

## API endpoints

- `GET /api/articles-public` — public article feed
- `GET /api/articles/slug/[slug]` — single by slug
- `GET, POST /api/articles` — admin list / create
- `GET, PATCH, DELETE /api/articles/[id]` — admin CRUD
- `GET, POST /api/announcements` — public list / admin create
- `PATCH, DELETE /api/announcements/[id]` — admin
- `POST /api/storage/article-img` — admin image upload for articles
- `POST /api/matches/[id]/postpone` — **also writes to `announcements`** (cross-feature touch)

## DB tables / RPCs

- `articles` — TipTap JSONB content, slug, status (draft/published/archived), view_count, featured_image, author_id, published_at
- `announcements` — title, body, format, start_at, end_at, pinned, priority, status
- **RPC `increment_article_view_count(article_slug)`** — defined but no call site found (see [dead-ends.md](../dead-ends.md))

## Components

### Public
- `components/AnnouncementContent.tsx`, `components/ArticleNavigation.tsx`, `components/ArticlePreview.tsx`, `components/RelatedArticles.tsx`
- Home: `home/HomeArticles.tsx`, `home/MiniAnnouncements.tsx`, `home/RecentAnnouncementsBubble.tsx`, `home/LeftSideBubbles.tsx`

### Admin
- `dashboard/articles/ArticlesAdmin.tsx`
- `dashboard/announcements/AnnouncementsAdmin.tsx`
- `components/RichTextEditor.tsx` (TipTap)

## Lib / utilities

- [`src/lib/articleUtils.ts`](../../../src/lib/articleUtils.ts) — `calculateReadTime`, `formatViewCount`, `formatReadTime`
- [`lib/fetchRecentNewsCount.ts`](../../../src/app/lib/fetchRecentNewsCount.ts) — counts both articles + announcements in last 2 days (for the navbar bubble)
- TipTap dependencies in `package.json`

## Known issues

1. **`/api/articles-public` defensive fallback** for missing `view_count` / `featured_image` columns — remove once schema confirmed.
2. **`increment_article_view_count` RPC** has no caller in source — view counts are likely never incremented.
3. **First-image extractor inlined in `/articles/page.tsx`** — should be in `lib/articleUtils.ts` for reuse.
4. **Two content systems** (articles + announcements) with overlapping use cases. Decide whether to unify long-term.
5. **Match postponement writes to `announcements`** — cross-feature side effect. Probably correct (postponements need to be announced), but document the dependency.
