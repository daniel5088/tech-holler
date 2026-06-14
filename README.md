# The Tech Holler

A production-oriented technology publication built with Next.js, Supabase, and the OpenAI API. It monitors public trend signals and automatically publishes AI articles only after they pass tightly capped research, verification, moderation, source, and duplicate gates. Human-curated articles remain private until approved.

The app runs with demonstration stories when external services are not configured. Demo stories are visibly labeled and are not presented as current reporting.

Static demonstration: https://daniel5088.github.io/tech-holler-pages/

## Features

- Responsive news homepage, category archives, search, article pages, methodology page, RSS, sitemap, and structured `NewsArticle` metadata.
- One consistent article format with a quick take, sourced reporting, confidence, forecast horizon, and revision history.
- Trend adapters for Google Trends RSS, Google News RSS, Hacker News, Bluesky, Mastodon, and optional YouTube Data API access.
- Thirty-minute trend scoring with multi-channel spike detection.
- A capped OpenAI workflow using one candidate, one low-context research call, one writing call, one verification call, moderation, and no image generation.
- Automatic publication for successful scheduled and authenticated on-demand AI runs.
- A separate private editorial queue with full draft and source review for human-curated articles.
- Talk Around Town analysis for clearly attributed, lower-confidence chatter that does not qualify as confirmed reporting.
- Duplicate-headline and copied-phrase checks before publication.
- Supabase Postgres schema, row-level security, audit records, image storage, and Cron/pg_net schedules.
- Protected operational dashboard and draft-generation endpoints with a global spending switch.

## Local Development

Requirements: Node.js 20 or newer and npm.

```bash
copy .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. With the default empty environment, the site uses seeded demonstration content and all automatic publishing remains disabled.

Useful checks:

```bash
npm run lint
npm run test
npm run build
npm run check
```

## Production Setup

1. Create a Supabase project and apply the SQL files in `supabase/migrations` in numeric order.
2. Create a Vercel project from this directory.
3. Copy every variable from `.env.example` into Vercel and supply production values.
4. Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS origin.
5. Set strong, different values for `CRON_SECRET` and `ADMIN_DASHBOARD_TOKEN`.
6. Add the Vercel origin and cron secret to Supabase Vault as shown in `002_cron_jobs.sql`.
7. Confirm `/api/health` reports the database, OpenAI, and cron authentication as ready.
8. Trigger `/api/cron/trends` manually and inspect `trend_sweeps` before enabling publication.
9. Leave `PUBLISHING_ENABLED=false` until automatic AI publication is intended. Enabling it permits the six fixed category slots and authenticated on-demand AI runs, which publish immediately after every content gate passes.

The production service role key and OpenAI key must only exist in server-side environment variables. Never expose either with a `NEXT_PUBLIC_` prefix.

## GitHub Pages

The private source repository validates a static demonstration on every push. Because the
current GitHub plan does not support Pages from private repositories, the generated site is
published from the separate public `daniel5088/tech-holler-pages` artifact repository.
GitHub Pages does not run the OpenAI, Supabase, cron, admin-session, or publishing
endpoints. Those capabilities still require the production deployment described above.
The Pages site contains labeled demonstration stories and a read-only operations view.

The repository remains private, but the GitHub Pages website is public.

## Automation Endpoints

All cron endpoints require `Authorization: Bearer <CRON_SECRET>`.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/cron/trends` | Collect, cluster, score, and persist public trend signals. |
| `POST /api/cron/breaking` | Paused; returns without researching or spending. |
| `POST /api/cron/daily` | Run the full AI pipeline for the current fixed Eastern category slot and automatically publish one successful article. |
| `GET /api/health` | Report service readiness without exposing secrets. |

For controlled testing, `/api/cron/daily?force=true` bypasses the time-window and scheduled-slot checks but still requires cron authentication and `PUBLISHING_ENABLED=true`. Add a valid `category` query parameter to target one section, or omit it for the existing general selection behavior. The admin dashboard also exposes an authenticated on-demand AI action that runs research, writing, verification, moderation, duplicate checks, and immediate publication; each click can incur AI usage. Both AI entry points are blocked while the switch is false. `EDITORIAL_DRAFT_TOKEN`, when temporarily configured, permits bearer-authenticated curated submission, manual approval, and on-demand AI requests, but it does not bypass the AI spending switch and should normally remain blank.

Editors can also submit schema-valid copy to `POST /api/admin/editorial-drafts/curated`. This path performs completeness, source-policy, phrase-reuse, duplicate, and moderation checks but makes zero generative model calls. It is the preferred path when an editor or coding agent has already researched and written the article.

Supabase Cron calls the trend and breaking endpoints every 30 minutes. Breaking generation is paused. It calls the daily endpoint hourly; the endpoint uses `America/New_York` and runs these fixed slots:

- 1:05 AM: AI & Robotics
- 5:05 AM: Computing & Gadgets
- 9:05 AM: Cyber & Internet
- 1:05 PM: Space & Science
- 5:05 PM: Sci-Fi to Reality
- 9:05 PM: Futurecasting

Each slot records its Eastern date, hour, and category. A category with no eligible candidate blocks before paid research, never substitutes another category, and is not retried automatically that day. Pending curated drafts do not block scheduled AI publication. Maximum intended usage is six guarded attempts per day.

## Editorial Rules

- Social, forum, opinion, and single-source activity may support a clearly labeled Talk Around Town analysis, but never becomes confirmed fact merely because it is linked.
- Breaking stories require at least two independent trusted domains and one primary or top-tier source.
- Ordinary reported stories still require independent confirmation. Uncertain or disputed claims may publish only in Talk Around Town mode with explicit attribution, a visible uncertainty note, and analysis separated from known facts.
- Missing attribution, fabricated claims, failed verification or moderation, copied phrasing, or equivalent existing coverage block publication in every mode.
- Forecasts must state a horizon, assumptions, and confidence.
- The narrator may use heavy dialect comedy and mild non-targeted profanity. Slurs, harassment, fabricated quotations, and demeaning stereotypes are prohibited.
- The low-cost AI pipeline does not call an image model; the site renders deterministic category artwork.

Reddit, X, Facebook, Instagram, and TikTok are intentionally absent from the default free-source implementation. Add them only through compliant official access and update the relevant platform terms review.

## Operations

The dashboard at `/admin` includes a one-click `Run AI pipeline now` action, a structured curated-article editor with live preview, expandable sections and sources, pending private drafts, and recent token usage. The AI action can incur usage and publishes immediately after every gate passes. Saving from the curated editor creates a private draft; publication occurs only when an authenticated editor presses the separate approval button. When `ADMIN_DASHBOARD_TOKEN` is set, access requires the token and is stored in a secure HTTP-only cookie.

To stop scheduled and on-demand AI generation, publication, and API spending immediately, set:

```text
PUBLISHING_ENABLED=false
```

Trend sweeps and curated dashboard drafting can continue while AI publishing is paused. Existing articles remain available. Corrections should update the article, append an `article_revisions` record, and retain the visible revision note.

## Security Note

`npm audit` currently reports a moderate PostCSS advisory in the PostCSS copy bundled inside Next.js 16.2.9. npm's automated `--force` recommendation downgrades Next.js to 9.3.3 and must not be used. Track the advisory and upgrade Next.js when its patched dependency is released.
