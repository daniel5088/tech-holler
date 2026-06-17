# Article Share + Like

Branch: `feat/article-share-and-like`

Adds a public **Share** bar and an anonymous, per-device **Like** toggle to the
article page (`src/app/article/[slug]/page.tsx`). Visitors stay anonymous — there
are no reader accounts. The app reads/writes Supabase exclusively through the
server-side service-role client (`getServiceSupabase`); the browser never holds a
Supabase key. Like counts are public; abuse handling is best-effort.

## Approved product decisions

- **Like** = toggle (like / unlike), one per device, anonymous. Counts shown
  publicly. Best-effort abuse handling (per-device unique + per-IP rate limit).
- **Share** targets: native Web Share API, copy-link fallback, plus explicit
  links for X, Bluesky, Facebook, and email.

## Phases

### Phase 1 — ShareBar (client, no backend)
`src/components/share-bar.tsx` (`"use client"`). Props: `url`, `title`.
- `navigator.share({ title, url })` when available (feature-detected).
- Copy-link fallback via `navigator.clipboard.writeText` with a transient
  "Copied" state (~2s).
- Explicit X / Bluesky / Facebook / email links (`lucide-react` icons).
- Optional `gtag('event', 'share', { method, item_id })` — no-op if GA absent.
- Rendered in the article header in `page.tsx`, under the byline.

### Phase 2 — Migration `supabase/migrations/003_reader_engagement.sql`
Version-controlled only; **not applied to production by this work.**
- `articles.like_count integer not null default 0 check (like_count >= 0)`.
- Recreate `published_articles` view (security_invoker) so `like_count` is exposed.
- `article_likes` table: `article_id uuid fk on delete cascade`,
  `visitor_hash text not null`, `ip_hash text`, `created_at timestamptz`,
  `unique (article_id, visitor_hash)`. RLS enabled, **no anon policies** (only the
  service role / SECURITY DEFINER RPC may touch it).
- `public.toggle_article_like(p_article_id uuid, p_visitor_hash text, p_ip_hash text)`
  SECURITY DEFINER: upserts-or-deletes the like row, atomically adjusts
  `articles.like_count`, enforces a per-IP-hash rate limit, returns
  `{ like_count, liked }`. `execute` revoked from `public`/`anon`; granted to
  `service_role` only.

### Phase 3 — Read path
`ArticleRow` + `mapArticle` (`src/lib/content.ts`) gain `like_count` → `likeCount`
(default 0; demo fallback defaults 0). The article page does a cheap
`article_likes` lookup by `visitor_hash` to compute `initiallyLiked`, and passes
`initialCount` + `initiallyLiked` to the like button.

### Phase 4 — Like API + button
`src/app/api/articles/[slug]/like/route.ts` (`POST` = toggle):
- `isSameOriginRequest` CSRF guard.
- Read/issue long-lived `th_vid` cookie (random uuid, httpOnly, sameSite lax, 1yr).
- `visitor_hash = sha256(vid + SALT)`, `ip_hash = sha256(xff + SALT)` where `SALT`
  is `process.env.READER_ENGAGEMENT_SALT` (never hardcoded).
- Resolve published article id from slug via service role.
- Call `toggle_article_like` RPC, return `{ likeCount, liked }`.

`src/components/like-button.tsx` (`"use client"`): optimistic toggle
(`aria-pressed`), disabled while in-flight, reconciles with the server count.
Placed next to ShareBar. GA `like` / `unlike` events.

## Validation
`npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`. Unit tests
added for the like route (CSRF reject, cookie issue, toggle round-trip) with a
mocked service client — no secrets, test-only values.

## Apply / config checklist (manual, before go-live)
1. Set env `READER_ENGAGEMENT_SALT` to a long random secret in all server
   environments (local `.env.local`, Render, any preview). Server-only — do NOT
   prefix with `NEXT_PUBLIC_`.
2. Apply `supabase/migrations/003_reader_engagement.sql` to the database
   (`supabase db push` or run the SQL in the SQL editor). Note: local `.env.local`
   points at production — applying locally hits the live DB.
3. Redeploy the app so the route + components ship together.

Do **not** merge, apply the migration, or deploy as part of this change.
