# AI Autopublishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish every successful AI-generated article automatically from scheduled and authenticated on-demand runs while keeping human-curated drafts behind manual approval.

**Architecture:** Keep `generateEditorialDraft` as the shared AI pipeline used by cron and the admin route. Change only its successful persistence boundary from `persistEditorialDraft` to `persistArticle`, return a `published` result, and remove the scheduled route's dependency on pending drafts. Preserve the separate curated queue and approval endpoint.

**Tech Stack:** Next.js 16 route handlers and server components, TypeScript, Vitest, Supabase, OpenAI API, Render.

---

## File Structure

- `src/lib/pipeline/editorial-queue.ts`: Shared AI pipeline and successful automatic-publication boundary.
- `src/lib/pipeline/editorial-queue.test.ts`: Pipeline persistence and safety-gate regression coverage.
- `src/app/api/cron/daily/route.ts`: Scheduled invocation, Eastern window, and slot idempotency.
- `src/app/api/cron/daily/route.test.ts`: Scheduled behavior without curated-draft blocking.
- `src/app/api/admin/editorial-drafts/generate/route.ts`: Authenticated on-demand invocation.
- `src/app/api/admin/editorial-drafts/generate/route.test.ts`: Authentication and shared-pipeline route coverage.
- `src/app/admin/page.tsx`: On-demand button, status language, usage warning, and curated-review labels.
- `README.md`: Operational description of automatic AI publication and manual curated approval.
- `SESSION_HANDOFF.md`: Untracked production handoff updated after deployment.

### Task 1: Publish Successful AI Output Directly

**Files:**
- Modify: `src/lib/pipeline/editorial-queue.test.ts`
- Modify: `src/lib/pipeline/editorial-queue.ts`

- [ ] **Step 1: Write the failing success-path test**

Replace the repository mock for `persistEditorialDraft` with `persistArticle`, and update
the success test to require a published result:

```ts
const mocks = vi.hoisted(() => ({
  // existing mocks
  persistArticle: vi.fn(),
}));

vi.mock("@/lib/pipeline/repository", () => ({
  persistArticle: mocks.persistArticle,
  persistResearchPacket: mocks.persistResearchPacket,
  recentPublishedHeadlines: mocks.recentPublishedHeadlines,
  recordJob: mocks.recordJob,
}));

it("publishes one verified AI article after exactly three text calls", async () => {
  const result = await generateEditorialDraft();

  expect(result.status).toBe("published");
  expect(mocks.researchTrend).toHaveBeenCalledTimes(1);
  expect(mocks.writeArticle).toHaveBeenCalledTimes(1);
  expect(mocks.verifyDraft).toHaveBeenCalledTimes(1);
  expect(mocks.persistArticle).toHaveBeenCalledWith(
    expect.objectContaining({
      id: expect.any(String),
      slug: draft.slug,
      title: draft.title,
    }),
  );
  expect(mocks.recordJob).toHaveBeenCalledWith(
    "editorial-draft",
    "completed",
    expect.objectContaining({
      article: expect.objectContaining({
        id: expect.any(String),
        slug: draft.slug,
        title: draft.title,
      }),
      callLimit: 3,
      imageGeneration: false,
      usage: expect.objectContaining({ calls: 3, totalTokens: 1510 }),
    }),
  );
});
```

- [ ] **Step 2: Write a failing blocked-path persistence test**

```ts
it("publishes nothing when verification blocks the AI article", async () => {
  mocks.verifyDraft.mockResolvedValue({ passes: false, report: "Unsupported claim" });

  const result = await generateEditorialDraft();

  expect(result.status).toBe("blocked");
  expect(mocks.persistArticle).not.toHaveBeenCalled();
  expect(mocks.recordJob).toHaveBeenCalledWith(
    "editorial-draft",
    "blocked",
    expect.objectContaining({ reason: "Verification failed" }),
  );
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```powershell
npm.cmd test -- src/lib/pipeline/editorial-queue.test.ts
```

Expected: FAIL because the pipeline still imports and calls `persistEditorialDraft` and
returns `completed`.

- [ ] **Step 4: Implement the minimal publication boundary**

In `src/lib/pipeline/editorial-queue.ts`, import `persistArticle` instead of
`persistEditorialDraft`. Extend `finish` so job status and response status can differ:

```ts
const finish = async (
  jobStatus: "completed" | "blocked" | "failed",
  details: Record<string, unknown>,
  responseStatus?: "published" | "blocked" | "failed",
) => {
  await recordJob("editorial-draft", jobStatus, {
    slot: options.slot,
    ...details,
    model,
    callLimit: 3,
    imageGeneration: false,
    maxOutputTokensPerGeneration: env.EDITORIAL_MAX_OUTPUT_TOKENS,
    usage: usageSummary(),
  });
  return {
    status: responseStatus ?? (jobStatus === "completed" ? "published" : jobStatus),
    ...details,
    usage: usageSummary(),
  };
};
```

Replace the final draft persistence and result:

```ts
await persistArticle(article);

return finish(
  "completed",
  {
    article: { id: article.id, slug: article.slug, title: article.title },
    candidate: { key: candidate.key, label: candidate.label },
    adapterErrors: errors,
  },
  "published",
);
```

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- src/lib/pipeline/editorial-queue.test.ts
```

Expected: all editorial queue tests pass.

- [ ] **Step 6: Commit the pipeline behavior**

```powershell
git add src/lib/pipeline/editorial-queue.ts src/lib/pipeline/editorial-queue.test.ts
git commit -m "Publish successful AI articles automatically"
```

### Task 2: Make Scheduled AI Runs Independent of Curated Drafts

**Files:**
- Modify: `src/app/api/cron/daily/route.test.ts`
- Modify: `src/app/api/cron/daily/route.ts`

- [ ] **Step 1: Update the route test to require independence**

Remove `hasPendingEditorialDraft` from the hoisted mocks and repository mock. Replace
the private-draft skip test with:

```ts
it("runs independently when curated drafts are awaiting review", async () => {
  const response = await POST(request());

  expect(await response.json()).toEqual({ status: "published" });
  expect(mocks.generateEditorialDraft).toHaveBeenCalledWith({
    slot: "2026-06-14-7",
  });
});
```

Set the default pipeline result:

```ts
mocks.generateEditorialDraft.mockResolvedValue({ status: "published" });
```

Rename the allowed-slot test:

```ts
it("publishes one AI article for an allowed unattempted slot", async () => {
  const response = await POST(request());

  expect(await response.json()).toEqual({ status: "published" });
  expect(mocks.generateEditorialDraft).toHaveBeenCalledWith({
    slot: "2026-06-14-7",
  });
});
```

- [ ] **Step 2: Run the focused route test and verify RED**

Run:

```powershell
npm.cmd test -- src/app/api/cron/daily/route.test.ts
```

Expected: FAIL because the route still imports and calls
`hasPendingEditorialDraft`.

- [ ] **Step 3: Remove the curated-draft queue check**

In `src/app/api/cron/daily/route.ts`, import only `hasJobForSlot`:

```ts
import { hasJobForSlot } from "@/lib/pipeline/repository";
```

Delete:

```ts
if (await hasPendingEditorialDraft()) {
  return NextResponse.json({
    status: "skipped",
    reason: "A private draft is already awaiting review",
  });
}
```

Do not change authorization, the kill switch, Eastern schedule, force behavior, or slot
idempotency.

- [ ] **Step 4: Run the focused route test and verify GREEN**

Run:

```powershell
npm.cmd test -- src/app/api/cron/daily/route.test.ts
```

Expected: all daily route tests pass.

- [ ] **Step 5: Commit the scheduling behavior**

```powershell
git add src/app/api/cron/daily/route.ts src/app/api/cron/daily/route.test.ts
git commit -m "Run scheduled AI publishing independently"
```

### Task 3: Verify the Authenticated On-Demand AI Route

**Files:**
- Create: `src/app/api/admin/editorial-drafts/generate/route.test.ts`
- Modify: `src/app/api/admin/editorial-drafts/generate/route.ts`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Write failing route tests**

Create a test with hoisted mocks:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAdminAuthenticated: vi.fn(),
  isEditorialDraftBearerAuthorized: vi.fn(),
  isSameOriginRequest: vi.fn(),
  generateEditorialDraft: vi.fn(),
}));

vi.mock("@/lib/admin-auth", () => ({
  isAdminAuthenticated: mocks.isAdminAuthenticated,
  isEditorialDraftBearerAuthorized: mocks.isEditorialDraftBearerAuthorized,
  isSameOriginRequest: mocks.isSameOriginRequest,
}));
vi.mock("@/lib/env", () => ({
  publishingEnabled: true,
  siteRedirectUrl: (path: string) => new URL(path, "https://thetechholler.com"),
}));
vi.mock("@/lib/pipeline/editorial-queue", () => ({
  generateEditorialDraft: mocks.generateEditorialDraft,
}));

import { POST } from "./route";

function request() {
  return new Request(
    "https://thetechholler.com/api/admin/editorial-drafts/generate",
    { method: "POST", headers: { origin: "https://thetechholler.com" } },
  );
}

describe("on-demand AI publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEditorialDraftBearerAuthorized.mockReturnValue(false);
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isAdminAuthenticated.mockResolvedValue(true);
    mocks.generateEditorialDraft.mockResolvedValue({
      status: "published",
      article: { id: "article-1", slug: "new-story", title: "New Story" },
    });
  });

  it("runs the shared publishing pipeline for an authenticated dashboard request", async () => {
    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://thetechholler.com/admin?aiResult=published",
    );
    expect(mocks.generateEditorialDraft).toHaveBeenCalledTimes(1);
  });

  it("rejects an unauthorized request without running the AI pipeline", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    mocks.isAdminAuthenticated.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });

  it("returns the published article to an authorized bearer client", async () => {
    mocks.isEditorialDraftBearerAuthorized.mockReturnValue(true);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        status: "published",
        article: expect.objectContaining({ slug: "new-story" }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run the focused route test and verify RED**

Run:

```powershell
npm.cmd test -- src/app/api/admin/editorial-drafts/generate/route.test.ts
```

Expected: FAIL because the route still redirects with `queueResult=published`.

- [ ] **Step 3: Make the route result naming explicit**

Keep the existing authorization and kill-switch checks. Rename local variables only
where needed for clarity:

```ts
const result = await generateEditorialDraft();
if (bearerAuthorized) return NextResponse.json(result);

const url = siteRedirectUrl("/admin");
url.searchParams.set("aiResult", result.status);
return NextResponse.redirect(url, 303);
```

No separate publishing call belongs in this route; the shared pipeline owns publication.

Update the admin page input contract:

```tsx
searchParams: Promise<{ aiResult?: string }>;
```

```ts
const aiResult = (await searchParams).aiResult;
```

- [ ] **Step 4: Run the focused route test and verify GREEN**

Run:

```powershell
npm.cmd test -- src/app/api/admin/editorial-drafts/generate/route.test.ts
```

Expected: all on-demand route tests pass.

- [ ] **Step 5: Commit route coverage**

```powershell
git add src/app/api/admin/editorial-drafts/generate/route.ts src/app/api/admin/editorial-drafts/generate/route.test.ts src/app/admin/page.tsx
git commit -m "Test on-demand AI publishing"
```

### Task 4: Update Admin Language Without Changing Curated Approval

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Update status and action copy**

Make these targeted changes:

```tsx
{ label: "AI publishing", ok: publishingEnabled, detail: publishingEnabled ? "Enabled" : "Kill switch active" }
```

```tsx
{publishingEnabled ? "AI publishing live" : "AI publishing paused"}
```

```tsx
<span>Curated review queue</span>
<strong>{drafts.length} drafts</strong>
<small>Manual approval required for editor-written articles</small>
```

```tsx
<span>Scheduled AI publishing</span>
<strong>{publishingEnabled ? "Enabled" : "Paused"}</strong>
<small>{scheduleLabel || "No valid hours"} Eastern; one attempt per slot</small>
```

Replace the AI panel heading and warning:

```tsx
<h2>Run AI pipeline now</h2>
<p>
  Researches, writes, verifies, moderates, checks duplicates, and publishes immediately.
  Each run can incur AI usage.
</p>
```

Replace button labels:

```tsx
<button type="submit">Run AI pipeline and publish</button>
```

```tsx
<button type="button" disabled>AI publishing paused</button>
```

Change result text:

```tsx
Latest AI run: {aiResult}
```

Rename the review heading:

```tsx
<h2>Curated drafts awaiting review</h2>
```

Do not change the curated editor form or the `Publish approved draft` button.

- [ ] **Step 2: Run lint and the focused tests**

Run:

```powershell
npm.cmd run lint
npm.cmd test -- src/lib/pipeline/editorial-queue.test.ts src/app/api/cron/daily/route.test.ts src/app/api/admin/editorial-drafts/generate/route.test.ts src/lib/pipeline/curated-draft.test.ts
```

Expected: lint exits 0 and all focused tests pass.

- [ ] **Step 3: Commit the admin update**

```powershell
git add src/app/admin/page.tsx
git commit -m "Expose on-demand AI publishing"
```

### Task 5: Update Documentation and Preserve Curated Semantics

**Files:**
- Modify: `README.md`
- Verify: `src/lib/pipeline/curated-draft.test.ts`
- Verify: `src/app/api/admin/editorial-drafts/[id]/publish/route.ts`

- [ ] **Step 1: Update operational documentation**

Change README statements so they explicitly say:

- Successful scheduled AI runs publish automatically.
- Successful authenticated admin AI runs publish automatically.
- AI runs do not wait for curated drafts.
- Curated editor submissions remain private and require manual approval.
- `PUBLISHING_ENABLED=false` pauses all AI generation and publishing.
- The admin button can incur usage and publish immediately.

Keep breaking generation documented as paused and retain the 7:05 AM Eastern schedule.

- [ ] **Step 2: Run curated workflow regression tests**

Run:

```powershell
npm.cmd test -- src/lib/pipeline/curated-draft.test.ts
```

Expected: curated drafts still call `persistEditorialDraft`, record zero generative
calls, and pass.

- [ ] **Step 3: Commit documentation**

```powershell
git add README.md
git commit -m "Document automatic AI publishing"
```

### Task 6: Full Verification and Review

**Files:**
- Review all modified files

- [ ] **Step 1: Run the full validation**

Run:

```powershell
npm.cmd run check
```

Expected:

- ESLint exits 0.
- All Vitest files and tests pass.
- TypeScript compilation and Next.js production build exit 0.

- [ ] **Step 2: Review the final diff**

Run:

```powershell
git diff origin/main...HEAD --check
git diff origin/main...HEAD -- src README.md docs/superpowers
git status --short --branch
```

Confirm:

- AI success calls `persistArticle`, never `persistEditorialDraft`.
- Blocked and failed AI paths do not persist.
- Curated success still calls `persistEditorialDraft`.
- Cron no longer queries pending drafts.
- Admin authorization and kill switch remain.
- `SESSION_HANDOFF.md` remains untracked.

### Task 7: Push, Deploy, Verify Production, and Update Handoff

**Files:**
- Modify after deployment: `SESSION_HANDOFF.md`

- [ ] **Step 1: Push private `main`**

Run:

```powershell
git push origin main
```

Expected: all implementation and documentation commits reach
`daniel5088/tech-holler`.

- [ ] **Step 2: Monitor Render**

Confirm the Render service deploys the new `main` commit and reaches `live`.

- [ ] **Step 3: Run read-only production checks**

Verify:

- `https://thetechholler.com/api/health` returns HTTP 200 and publishing enabled.
- `https://thetechholler.com/` returns HTTP 200 with existing content.
- `https://thetechholler.com/admin` remains authentication protected.
- Unauthenticated AI generation returns 401.
- Existing published article, RSS, and sitemap remain available.
- The authenticated admin HTML, after login, contains `Run AI pipeline now`.

Do not trigger the paid AI pipeline solely for deployment verification.

- [ ] **Step 4: Update the untracked handoff**

Update `SESSION_HANDOFF.md` with:

- Deployed commit and Render deployment.
- AI scheduled and on-demand runs publish automatically after all gates.
- Curated drafts remain manual.
- Pending curated drafts do not block AI runs.
- Admin on-demand warning and button.
- Verification results.
- Next scheduled attempt.

Keep the file untracked.

- [ ] **Step 5: Verify final repository and handoff state**

Run:

```powershell
git status --short --branch
```

Expected: `main` matches `origin/main`; the only untracked file is
`SESSION_HANDOFF.md`.
