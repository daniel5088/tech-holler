# AI Autopublishing Design

Date: June 14, 2026
Status: Approved design, pending implementation

## Objective

Automatically publish every article produced by the AI editorial pipeline after it
passes the existing research, verification, moderation, source, completeness, phrase
reuse, and duplicate gates. Keep human-curated articles private until an authenticated
editor approves them.

The AI pipeline must be runnable from both the daily schedule and an authenticated
admin-console button.

## Scope

Included:

- Scheduled AI runs publish successful articles immediately.
- Authenticated on-demand AI runs publish successful articles immediately.
- Pending curated drafts do not block scheduled or on-demand AI runs.
- Curated drafts retain the current manual approval workflow.
- Admin status, labels, and documentation describe the new behavior accurately.
- The production deployment and session handoff are updated after verification.

Excluded:

- Automatic publication of human-curated drafts.
- Separate admin controls for research, drafting, verification, or publication.
- Automatic retries after a blocked or failed scheduled run.
- Changes to breaking-news generation, which remains paused.
- New AI calls, image generation, or expanded token budgets.

## Architecture

The existing `generateEditorialDraft` pipeline remains the single AI entry point, but
its successful terminal action changes from persisting a private draft to persisting a
published article. A clearer name may be introduced during implementation if it
improves readability without duplicating pipeline behavior.

Both callers use this same function:

1. `POST /api/cron/daily` for the scheduled run.
2. `POST /api/admin/editorial-drafts/generate` for an authenticated on-demand run.

This shared path ensures scheduled and admin-triggered AI articles receive identical
research and safety checks.

The curated editor continues to call its separate `queueCuratedDraft` path. That path
persists an article with `status = draft`, and the existing authenticated approval
endpoint remains the only way to publish it.

## AI Publication Flow

An AI run performs these steps in order:

1. Collect trend signals and deterministically select one candidate.
2. Research the candidate.
3. Prune unsupported evidence and validate attribution.
4. Select reported or Talk Around Town editorial framing.
5. Write one complete article draft.
6. Reject incomplete paragraphs or invalid editorial-mode labeling.
7. Reject suspicious source phrase reuse.
8. Verify factual support and run moderation.
9. Reject duplicate coverage.
10. Persist the article directly with `status = published`, its publication timestamp,
    sources, and an initial revision identifying automated publication.
11. Record the AI job as completed with the published article identifier, slug, title,
    and token usage.

If any step fails or blocks, no article is persisted as published or draft.

## Scheduling

The existing Eastern schedule and slot idempotency remain:

- Supabase Cron checks the daily endpoint hourly.
- The configured eligible time remains 7:05 AM Eastern.
- Only one scheduled attempt is permitted for a slot.
- A blocked or failed scheduled attempt is not retried automatically.
- `PUBLISHING_ENABLED=false` pauses both scheduled and admin-triggered AI runs.

The scheduled route will no longer check for pending editorial drafts. Curated drafts
and AI publication therefore operate independently.

Forced authenticated cron requests continue to bypass only the time-window and slot
checks already bypassed by the current `force=true` behavior. They do not bypass
research, moderation, verification, source, completeness, or duplicate gates.

## Admin Console

The authenticated admin console exposes one primary action labeled
`Run AI pipeline now`.

Submitting it invokes the full shared AI pipeline:

`research -> write -> verify -> moderate -> duplicate check -> publish`

The action is available only when `PUBLISHING_ENABLED=true`. The existing admin
authentication, same-origin protection, and optional bearer authorization remain.

After execution, the console redirects back with a result that distinguishes:

- Published successfully
- Blocked by a content or safety gate
- Failed because of an operational error

The UI must not imply that an AI article is waiting for approval. Curated drafts remain
listed under a clearly manual review section with their existing publish button.

## Data and Provenance

No schema migration is required. Provenance remains distinguishable through the
separate code paths and revision/job metadata:

- AI publication writes an initial revision reason such as
  `Initial automated publication`.
- Curated drafting records `method = human-curated` and remains `status = draft`.
- AI job runs continue using `job_type = editorial-draft` unless implementation
  renames that value consistently in code, tests, documentation, and operational
  queries. Renaming is not required for this feature.

Manual publication code must never select an arbitrary draft for automatic
publication. The AI pipeline publishes only the in-memory article created by that
specific successful run.

## Failure Handling

- A content gate failure records a blocked job and publishes nothing.
- An infrastructure or persistence failure records a failed job when possible and
  returns an error result.
- Publication must not create a private fallback draft after a failure.
- Duplicate or repeated requests rely on the existing unique article constraints,
  duplicate detection, and scheduled slot idempotency.
- Curated drafts are unaffected by AI pipeline failures.

## Cost and Safety Controls

The following controls remain unchanged:

- One candidate per AI run.
- Three text-generation stages at most: research, draft, and verification.
- No image-generation call.
- Existing per-generation output token cap.
- Kill switch through `PUBLISHING_ENABLED`.
- Scheduled one-attempt-per-slot behavior.
- Source independence and attribution validation.
- Talk Around Town uncertainty labeling.
- Draft completeness validation.
- Phrase-reuse detection.
- Factual verification.
- Moderation.
- Duplicate detection.

On-demand admin runs are intentionally not limited by the daily schedule or daily slot.
Each click is an explicit authenticated request and may incur AI usage. The admin UI
must state that the action can incur usage and may publish immediately.

## Testing

Implementation follows test-first development.

Required automated coverage:

- A successful AI pipeline persists a published article and does not persist a private
  editorial draft.
- The completed job result contains the published article metadata.
- Every blocked safety-gate path publishes nothing.
- The scheduled route no longer checks or blocks on pending curated drafts.
- The scheduled route retains time-window and slot-idempotency behavior.
- The admin route invokes the same auto-publishing pipeline.
- Unauthorized admin requests remain rejected.
- `PUBLISHING_ENABLED=false` blocks scheduled and on-demand AI runs.
- Curated draft creation still persists a private draft.
- Curated manual approval still publishes only the selected curated draft.

Full verification requires lint, all tests, TypeScript checks, and the Next.js
production build.

## Deployment and Acceptance

After implementation:

1. Commit and push the tested changes to private `main`.
2. Monitor the Render deployment until the new commit is live.
3. Verify production health, homepage, admin authentication, and existing article.
4. Confirm the admin console displays the on-demand action and accurate warning text.
5. Do not trigger a paid on-demand production run solely for deployment verification
   unless the user explicitly requests it.
6. Update `SESSION_HANDOFF.md` with the deployed commit and automatic-publication
   behavior.

The feature is accepted when scheduled and authenticated on-demand AI runs share one
pipeline that publishes only after all existing gates pass, while curated drafts remain
private until manually approved.
