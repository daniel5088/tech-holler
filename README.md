# The Tech Holler

A production-oriented automated technology publication built with Next.js, Supabase, and the OpenAI API. It monitors public trend signals, verifies topics against trustworthy sources, writes original articles in a comedic Alabama narrator voice, and publishes on a fixed daily schedule or after a conservative breaking-news gate.

The app runs with demonstration stories when external services are not configured. Demo stories are visibly labeled and are not presented as current reporting.

## Features

- Responsive news homepage, category archives, search, article pages, methodology page, RSS, sitemap, and structured `NewsArticle` metadata.
- One consistent article format with a quick take, sourced reporting, confidence, forecast horizon, revision history, and generated editorial artwork.
- Trend adapters for Google Trends RSS, Google News RSS, Hacker News, Bluesky, Mastodon, and optional YouTube Data API access.
- Thirty-minute trend scoring with multi-channel spike detection.
- OpenAI Responses API research, schema-constrained article writing, a separate verification pass, moderation, and GPT Image generation.
- Conservative breaking gate requiring two trend channels and two independent trusted factual sources, including one primary or top-tier source.
- Duplicate-headline and copied-phrase checks before publication.
- Supabase Postgres schema, row-level security, audit records, image storage, and Cron/pg_net schedules.
- Protected operational dashboard and automation endpoints with a global publishing kill switch.

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
9. Set `PUBLISHING_ENABLED=true` only after source adapters, OpenAI generation, image storage, and audit records have been verified.

The production service role key and OpenAI key must only exist in server-side environment variables. Never expose either with a `NEXT_PUBLIC_` prefix.

## Automation Endpoints

All cron endpoints require `Authorization: Bearer <CRON_SECRET>`.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/cron/trends` | Collect, cluster, score, and persist public trend signals. |
| `POST /api/cron/breaking` | Research the strongest qualified spike and publish only after every gate passes. |
| `POST /api/cron/daily` | Publish one story during the 7 AM, 1 PM, or 7 PM Eastern slot. |
| `GET /api/health` | Report service readiness without exposing secrets. |

For controlled testing, `/api/cron/daily?force=true` bypasses the time-window check but still requires cron authentication and `PUBLISHING_ENABLED=true`.

Supabase Cron calls the trend and breaking endpoints every 30 minutes. It calls the daily endpoint hourly; the endpoint itself uses `America/New_York` and an idempotent slot key so daylight-saving changes do not shift the editorial schedule or create duplicate runs.

## Editorial Rules

- Social and forum activity is a discovery signal, never factual confirmation.
- Breaking stories require at least two independent trusted domains and one primary or top-tier source.
- Uncertain claims, materially conflicting evidence, missing citations, failed moderation, copied phrasing, or equivalent existing coverage block publication.
- Forecasts must state a horizon, assumptions, and confidence.
- The narrator may use heavy dialect comedy and mild non-targeted profanity. Slurs, harassment, fabricated quotations, and demeaning stereotypes are prohibited.
- Generated artwork must be editorial and non-photorealistic, with no logos, text, or deceptive depiction of an actual event.
- Image-generation failure does not block an otherwise verified story; the site renders deterministic category artwork.

Reddit, X, Facebook, Instagram, and TikTok are intentionally absent from the default free-source implementation. Add them only through compliant official access and update the relevant platform terms review.

## Operations

The dashboard at `/admin` shows configuration readiness and endpoint details. When `ADMIN_DASHBOARD_TOKEN` is set, access requires the token and is stored in a secure HTTP-only cookie.

To stop all new publishing immediately, set:

```text
PUBLISHING_ENABLED=false
```

Trend sweeps can continue while publishing is paused. Existing articles remain available. Corrections should update the article, append an `article_revisions` record, and retain the visible revision note.

## Security Note

`npm audit` currently reports a moderate PostCSS advisory in the PostCSS copy bundled inside Next.js 16.2.9. npm's automated `--force` recommendation downgrades Next.js to 9.3.3 and must not be used. Track the advisory and upgrade Next.js when its patched dependency is released.
