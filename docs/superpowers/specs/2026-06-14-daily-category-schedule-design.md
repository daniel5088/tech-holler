# Daily Category Schedule Design

Date: June 14, 2026
Status: Approved design, pending implementation

## Objective

Publish up to six AI-generated articles each day, with one guarded attempt for each Tech
Holler category. Stagger the attempts across the day in Eastern time so publication is
distributed rather than concentrated in one batch.

## Schedule

Supabase Cron continues to call `POST /api/cron/daily` at minute 5 of every hour. The
application assigns these Eastern hours:

| Eastern time | Category |
| --- | --- |
| 1:05 AM | AI & Robotics (`ai-robotics`) |
| 5:05 AM | Computing & Gadgets (`computing-gadgets`) |
| 9:05 AM | Cyber & Internet (`cyber-internet`) |
| 1:05 PM | Space & Science (`space-science`) |
| 5:05 PM | Sci-Fi to Reality (`sci-fi-reality`) |
| 9:05 PM | Futurecasting (`futurecasting`) |

Hours not listed above return a skipped result without researching or spending.

## Category Targeting

Each scheduled run passes its assigned category into the shared AI pipeline. Candidate
selection must consider only candidates that can reasonably support that category.

Category targeting is strict:

- A run never substitutes an article from another category.
- The researched packet must return the assigned category.
- The written article must return the assigned category.
- Any mismatch blocks the run before persistence.
- If no suitable category candidate exists, the run publishes nothing.

Candidate-category classification should be deterministic and local, using topic titles
and signal metadata before any paid research call. The classifier may use focused
keyword and phrase rules for the six established categories. Ambiguous candidates that
do not match the assigned category are excluded.

The existing global ranking still determines the strongest eligible candidate within
the assigned category.

## Pipeline

The existing `generateEditorialDraft` function remains the shared pipeline. It accepts
an optional target category:

```ts
generateEditorialDraft({
  slot?: string;
  category?: CategorySlug;
})
```

Scheduled calls provide both `slot` and `category`. The existing authenticated
on-demand admin action provides neither and continues to select the strongest eligible
candidate across all categories.

The category-targeted pipeline retains every existing step:

1. Collect trend signals.
2. Cluster and rank candidates.
3. Filter candidates to the assigned category.
4. Select one candidate.
5. Research and clean evidence.
6. Validate sources and attribution.
7. Write and normalize the article.
8. Enforce the assigned category on research and draft output.
9. Check phrase reuse.
10. Verify factual support and run moderation.
11. Check duplicate coverage.
12. Publish directly only after every gate passes.

No new AI calls or larger token budgets are introduced.

## Idempotency

Each scheduled attempt uses a category-specific slot containing the Eastern date, hour,
and category. The existing `job_runs` lookup prevents a second attempt for that slot
regardless of whether the first attempt completed, blocked, or failed.

Examples:

```text
2026-06-15-1-ai-robotics
2026-06-15-5-computing-gadgets
2026-06-15-9-cyber-internet
```

The job details record the category for operational visibility.

Forced cron requests retain their current semantics: authenticated `force=true`
bypasses the current-hour and slot-idempotency checks. A forced request may include a
valid category parameter to target a section. It must not bypass category matching or
any content gate. If no category is supplied, it uses the existing general on-demand
selection behavior.

## Failure Handling

- No eligible category candidate: blocked, no AI research call, no publication.
- Research packet category mismatch: blocked, no drafting or publication.
- Draft category mismatch: blocked, no publication.
- Any existing content gate failure: blocked, no publication.
- Infrastructure failure: failed job when recordable, no fallback draft.
- A blocked or failed category slot is not retried automatically that day.
- Failure in one category does not block another category's later slot.

## Admin and Curated Workflows

The authenticated `Run AI pipeline now` action remains a general untargeted run and
publishes immediately after all gates pass.

The curated editor remains unchanged:

- Curated articles are private drafts.
- Curated drafts require manual approval.
- Curated drafts do not block category-scheduled AI runs.

The admin dashboard schedule panel lists all six Eastern slots and their categories.

## Configuration

The six-slot schedule is an application constant rather than an environment string.
This avoids malformed production configuration and keeps category-to-hour assignment
versioned and testable.

`EDITORIAL_SCHEDULE_HOURS` becomes obsolete for scheduled AI publication and should be
removed from active code, documentation, and production environment configuration after
the new deployment is live. Historical migrations may keep their hourly cron call
because the endpoint still performs the Eastern slot decision.

`PUBLISHING_ENABLED=false` remains the immediate kill switch for every scheduled and
on-demand AI run.

## Cost and Safety Controls

Each category slot retains:

- One candidate.
- At most one research call.
- At most one draft call.
- At most one verification call.
- No image-generation call.
- Source independence and attribution checks.
- Talk Around Town uncertainty labeling.
- Completeness checks.
- Phrase-reuse checks.
- Verification and moderation.
- Duplicate detection.

Maximum intended daily AI usage becomes six guarded attempts. A category with no
eligible candidate should block before paid research.

## Testing

Implementation follows test-first development.

Required coverage:

- Schedule maps the six specified Eastern hours to the correct categories.
- All other hours are skipped.
- Slot keys include date, hour, and category.
- DST behavior remains based on `America/New_York`.
- Scheduled route passes the assigned category into the pipeline.
- A previously attempted category slot is skipped.
- One category's job does not block another category's slot.
- Candidate filtering returns only matching category candidates.
- No matching candidate blocks before `researchTrend`.
- Research packet category mismatch blocks before `writeArticle`.
- Draft category mismatch blocks before publication.
- Successful targeted output publishes with the assigned category.
- General admin-triggered AI runs remain untargeted.
- Curated drafting and manual approval remain unchanged.
- Kill switch blocks every scheduled category slot.

Full verification requires ESLint, all Vitest tests, TypeScript, and the Next.js
production build.

## Deployment and Acceptance

After implementation:

1. Commit and push tested changes to private `main`.
2. Monitor Render until the new commit is live.
3. Remove obsolete `EDITORIAL_SCHEDULE_HOURS` from Render after the new code is live.
4. Verify health, homepage, existing article, RSS, sitemap, admin protection, and
   unauthenticated AI rejection.
5. Confirm the authenticated admin dashboard displays the six-slot schedule.
6. Do not trigger all six paid runs solely for deployment verification.
7. Update `SESSION_HANDOFF.md` with the deployed commit and exact category schedule.

The feature is accepted when the hourly cron produces at most one strictly
category-matched article at each of the six configured Eastern slots, with no fallback
category and no weakening of existing safety gates.
