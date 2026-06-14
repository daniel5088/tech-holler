# Daily Category Schedule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run six strictly category-targeted AI publishing slots every day at 1:05 AM, 5:05 AM, 9:05 AM, 1:05 PM, 5:05 PM, and 9:05 PM Eastern.

**Architecture:** Add a fixed typed schedule and deterministic category classifier. The cron route resolves the current Eastern slot and passes its category into the existing shared AI pipeline; the pipeline filters candidates before research and blocks any research or draft category mismatch before publication. General authenticated on-demand AI runs remain untargeted.

**Tech Stack:** Next.js 16, TypeScript, Vitest, Supabase Cron, OpenAI API, Render.

---

## File Structure

- `src/lib/pipeline/schedule.ts`: Fixed six-category Eastern schedule and category-specific slot keys.
- `src/lib/pipeline/schedule.test.ts`: Schedule, slot, and DST tests.
- `src/lib/pipeline/trend-scoring.ts`: Deterministic category scoring and candidate filtering.
- `src/lib/pipeline/trend-scoring.test.ts`: Six-category classification and ambiguity tests.
- `src/lib/pipeline/editorial-queue.ts`: Optional target category and mismatch gates.
- `src/lib/pipeline/editorial-queue.test.ts`: Pre-research filtering and targeted publication tests.
- `src/lib/pipeline/openai.ts`: Optional research prompt category guidance.
- `src/app/api/cron/daily/route.ts`: Scheduled category resolution and forced category parsing.
- `src/app/api/cron/daily/route.test.ts`: Route schedule, idempotency, forced, and kill-switch tests.
- `src/app/admin/page.tsx`: Six-slot schedule display.
- `src/lib/env.ts`, `.env.example`, `README.md`: Remove active `EDITORIAL_SCHEDULE_HOURS` configuration and document fixed schedule.
- `supabase/migrations/002_cron_jobs.sql`: Correct the schedule comment; hourly cron remains unchanged.
- `SESSION_HANDOFF.md`: Update only after production deployment; keep untracked.

### Task 1: Define the Fixed Eastern Category Schedule

**Files:**
- Modify: `src/lib/pipeline/schedule.test.ts`
- Modify: `src/lib/pipeline/schedule.ts`

- [ ] **Step 1: Write failing schedule tests**

Replace the configurable-hour tests with:

```ts
import { describe, expect, it } from "vitest";
import {
  CATEGORY_SCHEDULE,
  easternCategorySlot,
  formatCategorySchedule,
} from "./schedule";

describe("daily category schedule", () => {
  it("maps six Eastern hours to the six editorial categories", () => {
    expect(CATEGORY_SCHEDULE.map(({ hour, category }) => ({ hour, category }))).toEqual([
      { hour: 1, category: "ai-robotics" },
      { hour: 5, category: "computing-gadgets" },
      { hour: 9, category: "cyber-internet" },
      { hour: 13, category: "space-science" },
      { hour: 17, category: "sci-fi-reality" },
      { hour: 21, category: "futurecasting" },
    ]);
  });

  it("builds a category-specific slot in daylight-saving time", () => {
    expect(easternCategorySlot(new Date("2026-06-14T17:05:00Z"))).toEqual({
      hour: 13,
      category: "space-science",
      slot: "2026-06-14-13-space-science",
    });
  });

  it("builds the same Eastern slot shape in standard time", () => {
    expect(easternCategorySlot(new Date("2026-12-14T18:05:00Z"))).toEqual({
      hour: 13,
      category: "space-science",
      slot: "2026-12-14-13-space-science",
    });
  });

  it("returns no category outside a configured hour", () => {
    expect(easternCategorySlot(new Date("2026-06-14T18:05:00Z"))).toEqual({
      hour: 14,
      category: null,
      slot: null,
    });
  });

  it("formats all schedule entries for the dashboard", () => {
    expect(formatCategorySchedule()).toEqual([
      "1 AM - AI & Robotics",
      "5 AM - Computing & Gadgets",
      "9 AM - Cyber & Internet",
      "1 PM - Space & Science",
      "5 PM - Sci-Fi to Reality",
      "9 PM - Futurecasting",
    ]);
  });
});
```

- [ ] **Step 2: Run the schedule test and verify RED**

Run:

```powershell
npm.cmd test -- src/lib/pipeline/schedule.test.ts
```

Expected: FAIL because the fixed category schedule exports do not exist.

- [ ] **Step 3: Implement the typed schedule**

Use the site category names and `CategorySlug`:

```ts
import type { CategorySlug } from "@/types/content";

export const CATEGORY_SCHEDULE: ReadonlyArray<{
  hour: number;
  category: CategorySlug;
  label: string;
}> = [
  { hour: 1, category: "ai-robotics", label: "AI & Robotics" },
  { hour: 5, category: "computing-gadgets", label: "Computing & Gadgets" },
  { hour: 9, category: "cyber-internet", label: "Cyber & Internet" },
  { hour: 13, category: "space-science", label: "Space & Science" },
  { hour: 17, category: "sci-fi-reality", label: "Sci-Fi to Reality" },
  { hour: 21, category: "futurecasting", label: "Futurecasting" },
];
```

Implement `easternCategorySlot(date)` using `America/New_York`. It returns the current
hour plus either the matching category-specific slot or `null` values. Implement
`formatCategorySchedule()` from the constants. Remove `parseScheduleHours`,
`formatScheduleHours`, and `easternDraftSlot`.

- [ ] **Step 4: Run the schedule test and verify GREEN**

Run:

```powershell
npm.cmd test -- src/lib/pipeline/schedule.test.ts
```

Expected: all schedule tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/pipeline/schedule.ts src/lib/pipeline/schedule.test.ts
git commit -m "Define daily category publishing slots"
```

### Task 2: Classify Candidates Before Paid Research

**Files:**
- Modify: `src/lib/pipeline/trend-scoring.test.ts`
- Modify: `src/lib/pipeline/trend-scoring.ts`

- [ ] **Step 1: Write failing classifier tests**

Import `classifyTrendCategory` and `selectCategoryCandidates`. Add one strong example
per category and one ambiguous example:

```ts
it.each([
  ["OpenAI releases new reasoning model for autonomous robots", "ai-robotics"],
  ["Nvidia unveils next-generation laptop GPU and processor", "computing-gadgets"],
  ["CISA confirms cloud authentication breach investigation", "cyber-internet"],
  ["NASA delays Artemis lunar mission after heat shield review", "space-science"],
  ["Star Trek communicator inspires working universal translator prototype", "sci-fi-reality"],
  ["Analysts forecast quantum networks could expand by 2030", "futurecasting"],
])("classifies %s as %s", (title, category) => {
  expect(classifyTrendCategory({ ...candidateCluster, label: title })).toBe(category);
});

it("rejects an ambiguous candidate instead of assigning a fallback category", () => {
  expect(
    classifyTrendCategory({
      ...candidateCluster,
      label: "Technology companies announce several new products",
    }),
  ).toBeNull();
});

it("filters ranked candidates to the requested category", () => {
  const selected = selectCategoryCandidates(
    [
      { ...candidateCluster, key: "space", label: "NASA launches lunar science mission" },
      { ...candidateCluster, key: "cyber", label: "CISA confirms major software vulnerability" },
    ],
    "space-science",
  );

  expect(selected.map(({ key }) => key)).toEqual(["space"]);
});
```

Use a local `candidateCluster` fixture with a qualifying score, factual signal, and
selection score.

- [ ] **Step 2: Run the trend-scoring test and verify RED**

Run:

```powershell
npm.cmd test -- src/lib/pipeline/trend-scoring.test.ts
```

Expected: FAIL because category classification APIs do not exist.

- [ ] **Step 3: Implement deterministic score-based classification**

Add category regex groups with weighted strong and supporting patterns. Score the
cluster label and item titles together. Return the highest category only when:

- its score is at least 3; and
- it beats the second-highest score by at least 2.

Otherwise return `null`.

Use strong terms such as:

- AI & Robotics: `artificial intelligence`, `machine learning`, `OpenAI`, `robot`,
  `robotics`, `neural model`, `chatbot`.
- Computing & Gadgets: `chip`, `semiconductor`, `processor`, `GPU`, `CPU`, `laptop`,
  `smartphone`, `device`, `hardware`.
- Cyber & Internet: `breach`, `vulnerability`, `malware`, `ransomware`, `CISA`,
  `cybersecurity`, `authentication`, `network security`.
- Space & Science: `NASA`, `spacecraft`, `rocket`, `lunar`, `Mars`, `telescope`,
  `researchers discover`, `scientists`.
- Sci-Fi to Reality: `science fiction`, `sci-fi`, `Star Trek`, `Star Wars`,
  `communicator`, `exoskeleton`, `teleport`, `fiction inspires`.
- Futurecasting: `forecast`, `prediction`, `by 20xx`, `future of`, `could become`,
  `next decade`, `outlook`.

Implement:

```ts
export function classifyTrendCategory(cluster: TrendCluster): CategorySlug | null;
export function selectCategoryCandidates(
  clusters: TrendCluster[],
  category: CategorySlug,
): TrendCluster[];
```

`selectCategoryCandidates` first uses the existing daily eligibility filters and ranking,
then keeps only exact classifier matches.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- src/lib/pipeline/trend-scoring.test.ts
```

Expected: all trend-scoring tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/pipeline/trend-scoring.ts src/lib/pipeline/trend-scoring.test.ts
git commit -m "Classify AI candidates by editorial category"
```

### Task 3: Enforce Target Category Throughout the AI Pipeline

**Files:**
- Modify: `src/lib/pipeline/editorial-queue.test.ts`
- Modify: `src/lib/pipeline/editorial-queue.ts`
- Modify: `src/lib/pipeline/openai.ts`

- [ ] **Step 1: Write failing targeted-pipeline tests**

Add `selectCategoryCandidates` to the trend-scoring mock. Test:

```ts
it("blocks before paid research when no candidate matches the target category", async () => {
  mocks.selectCategoryCandidates.mockReturnValue([]);

  const result = await generateEditorialDraft({ category: "space-science" });

  expect(result.status).toBe("blocked");
  expect(result.reason).toBe("No candidate matched the scheduled category");
  expect(mocks.researchTrend).not.toHaveBeenCalled();
  expect(mocks.persistArticle).not.toHaveBeenCalled();
});

it("blocks a research packet that returns a different category", async () => {
  mocks.selectCategoryCandidates.mockReturnValue([candidate]);
  mocks.researchTrend.mockResolvedValue({ ...packet, category: "cyber-internet" });

  const result = await generateEditorialDraft({ category: "space-science" });

  expect(result.status).toBe("blocked");
  expect(result.reason).toBe("Research category did not match scheduled category");
  expect(mocks.writeArticle).not.toHaveBeenCalled();
});

it("blocks a draft that returns a different category", async () => {
  mocks.selectCategoryCandidates.mockReturnValue([candidate]);
  mocks.researchTrend.mockResolvedValue({ ...packet, category: "space-science" });
  mocks.writeArticle.mockResolvedValue({ ...draft, category: "cyber-internet" });

  const result = await generateEditorialDraft({ category: "space-science" });

  expect(result.status).toBe("blocked");
  expect(result.reason).toBe("Draft category did not match scheduled category");
  expect(mocks.persistArticle).not.toHaveBeenCalled();
});

it("publishes a targeted article with the scheduled category", async () => {
  mocks.selectCategoryCandidates.mockReturnValue([candidate]);
  mocks.researchTrend.mockResolvedValue({ ...packet, category: "space-science" });
  mocks.writeArticle.mockResolvedValue({ ...draft, category: "space-science" });

  const result = await generateEditorialDraft({
    slot: "2026-06-15-13-space-science",
    category: "space-science",
  });

  expect(result.status).toBe("published");
  expect(mocks.persistArticle).toHaveBeenCalledWith(
    expect.objectContaining({ category: "space-science" }),
  );
  expect(mocks.recordJob).toHaveBeenCalledWith(
    "editorial-draft",
    "completed",
    expect.objectContaining({ category: "space-science" }),
  );
});
```

Keep existing untargeted tests and default `selectCategoryCandidates` behavior.

- [ ] **Step 2: Run the editorial queue test and verify RED**

Run:

```powershell
npm.cmd test -- src/lib/pipeline/editorial-queue.test.ts
```

Expected: FAIL because the pipeline does not accept or enforce a category.

- [ ] **Step 3: Implement category targeting**

Change the signature:

```ts
export async function generateEditorialDraft(
  options: { slot?: string; category?: CategorySlug } = {},
)
```

Record `category: options.category` in every job. For candidate selection:

```ts
const candidates = options.category
  ? selectCategoryCandidates(clusters, options.category)
  : selectPublishingCandidates(clusters, "daily");
const [candidate] = candidates;
```

Use the targeted no-candidate reason when `options.category` exists. Pass the category
into `researchTrend` request options so the prompt explicitly requests that desk.

Immediately after evidence cleanup:

```ts
if (options.category && packet.category !== options.category) {
  return finish("blocked", {
    reason: "Research category did not match scheduled category",
    expectedCategory: options.category,
    actualCategory: packet.category,
  });
}
```

Immediately after draft normalization:

```ts
if (options.category && draft.category !== options.category) {
  return finish("blocked", {
    reason: "Draft category did not match scheduled category",
    expectedCategory: options.category,
    actualCategory: draft.category,
  });
}
```

Extend OpenAI `RequestOptions` with `targetCategory?: CategorySlug`. Add this sentence to
the research user prompt only when provided:

```text
This is for the <category> desk. Return that exact category or decline to produce a packet.
```

The structured mismatch gate remains authoritative even if the model ignores the prompt.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```powershell
npm.cmd test -- src/lib/pipeline/editorial-queue.test.ts
```

Expected: all targeted and untargeted pipeline tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/pipeline/editorial-queue.ts src/lib/pipeline/editorial-queue.test.ts src/lib/pipeline/openai.ts
git commit -m "Enforce scheduled article categories"
```

### Task 4: Wire Category Slots Into the Cron Route

**Files:**
- Modify: `src/app/api/cron/daily/route.test.ts`
- Modify: `src/app/api/cron/daily/route.ts`

- [ ] **Step 1: Write failing route tests**

Update the schedule mock to return category-specific values. Require:

```ts
mocks.easternCategorySlot.mockReturnValue({
  hour: 13,
  category: "space-science",
  slot: "2026-06-14-13-space-science",
});
```

Test that scheduled invocation calls:

```ts
expect(mocks.generateEditorialDraft).toHaveBeenCalledWith({
  slot: "2026-06-14-13-space-science",
  category: "space-science",
});
```

Add tests for:

- outside hour returns skipped and does not call `hasJobForSlot`;
- attempted Space slot skips without affecting another category slot;
- `force=true&category=futurecasting` calls the untimed targeted pipeline without a slot;
- `force=true` with no category calls `generateEditorialDraft({})`;
- invalid forced category returns HTTP 400;
- kill switch still returns HTTP 409.

- [ ] **Step 2: Run the route test and verify RED**

Run:

```powershell
npm.cmd test -- src/app/api/cron/daily/route.test.ts
```

Expected: FAIL because the route still uses configurable hours and an untargeted slot.

- [ ] **Step 3: Implement route resolution**

Import `CategorySlug`, `easternCategorySlot`, and a category validation helper. Behavior:

```ts
const forced = url.searchParams.get("force") === "true";
const categoryParam = url.searchParams.get("category");
const forcedCategory = categoryParam ? parseCategorySlug(categoryParam) : undefined;

if (forced && categoryParam && !forcedCategory) {
  return NextResponse.json({ error: "Invalid category" }, { status: 400 });
}

const schedule = easternCategorySlot();
if (!forced && (!schedule.category || !schedule.slot)) {
  return NextResponse.json({
    status: "skipped",
    reason: "Outside an Eastern category publishing window",
  });
}

const category = forced ? forcedCategory : schedule.category;
const slot = forced ? undefined : schedule.slot;
```

Only scheduled calls check `hasJobForSlot`. Call:

```ts
generateEditorialDraft({
  ...(slot ? { slot } : {}),
  ...(category ? { category } : {}),
});
```

Implement `parseCategorySlug` from the six known schedule categories in `schedule.ts`.

- [ ] **Step 4: Run the focused route tests and verify GREEN**

Run:

```powershell
npm.cmd test -- src/app/api/cron/daily/route.test.ts
```

Expected: all route tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/app/api/cron/daily/route.ts src/app/api/cron/daily/route.test.ts src/lib/pipeline/schedule.ts src/lib/pipeline/schedule.test.ts
git commit -m "Schedule six daily category runs"
```

### Task 5: Update Admin and Remove Obsolete Configuration

**Files:**
- Modify: `src/app/admin/page.tsx`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `supabase/migrations/002_cron_jobs.sql`

- [ ] **Step 1: Update the admin schedule display**

Import `formatCategorySchedule` and render all six lines in the scheduled publishing
card or panel:

```tsx
const scheduleLabels = formatCategorySchedule();
```

```tsx
<small>{scheduleLabels.join(" | ")} Eastern</small>
```

Keep the general `Run AI pipeline now` button unchanged.

- [ ] **Step 2: Remove active environment configuration**

Delete `EDITORIAL_SCHEDULE_HOURS` from:

- `envSchema`;
- the `envSchema.parse` object;
- `.env.example`;
- README setup and operations text.

Update README with the exact six fixed category slots and maximum six guarded attempts
per day. State that no eligible candidate blocks before paid research.

Update the migration comment to:

```sql
-- The endpoint checks America/New_York and maps fixed hours to category publishing slots.
```

- [ ] **Step 3: Run focused tests and lint**

Run:

```powershell
npm.cmd run lint
npm.cmd test -- src/lib/pipeline/schedule.test.ts src/lib/pipeline/trend-scoring.test.ts src/lib/pipeline/editorial-queue.test.ts src/app/api/cron/daily/route.test.ts src/app/api/admin/editorial-drafts/generate/route.test.ts src/lib/pipeline/curated-draft.test.ts
```

Expected: lint exits 0 and all focused tests pass.

- [ ] **Step 4: Commit**

```powershell
git add src/app/admin/page.tsx src/lib/env.ts .env.example README.md supabase/migrations/002_cron_jobs.sql
git commit -m "Document fixed category publishing schedule"
```

### Task 6: Full Verification and Review

**Files:**
- Review all modified files

- [ ] **Step 1: Run full validation**

Run:

```powershell
npm.cmd run check
```

Expected: ESLint, all tests, TypeScript, and Next.js production build pass.

- [ ] **Step 2: Review requirements and diff**

Run:

```powershell
git diff origin/main...HEAD --check
git diff origin/main...HEAD -- src README.md .env.example supabase docs/superpowers
git status --short --branch
```

Confirm:

- all six hours and categories are exact;
- outside hours spend nothing;
- targeted no-match blocks before research;
- packet and draft mismatch block publication;
- category is in slot and job details;
- general admin AI remains untargeted;
- curated workflow remains manual;
- `EDITORIAL_SCHEDULE_HOURS` has no active references;
- `SESSION_HANDOFF.md` remains the only untracked file.

### Task 7: Push, Deploy, Update Render, Verify, and Refresh Handoff

**Files:**
- Modify after deployment: `SESSION_HANDOFF.md`

- [ ] **Step 1: Push private `main`**

```powershell
git push origin main
```

- [ ] **Step 2: Monitor Render to live**

Confirm the new deploy uses the final commit and reaches `live`.

- [ ] **Step 3: Clear the obsolete Render setting**

Set `EDITORIAL_SCHEDULE_HOURS` to an empty value through the safe merge-style Render
environment update. Do not replace the full environment set or expose secrets. Monitor
the resulting environment deploy to `live`.

- [ ] **Step 4: Verify production without paid generation**

Check:

- health is HTTP 200 and ready;
- homepage and existing article are HTTP 200;
- RSS and sitemap contain the article;
- admin remains protected;
- unauthenticated AI execution returns 401;
- authenticated dashboard displays the six fixed slots when inspected through the
  existing logged-in session, if available.

Do not invoke the paid category pipeline solely for deployment verification.

- [ ] **Step 5: Update the untracked handoff**

Record:

- deployed commit and Render deploy;
- exact six category slots;
- strict no-fallback category behavior;
- maximum six guarded attempts daily;
- verification results;
- next upcoming category slot;
- `EDITORIAL_SCHEDULE_HOURS` is inactive.

- [ ] **Step 6: Verify final repository state**

```powershell
git status --short --branch
```

Expected: `main` matches `origin/main`; only `SESSION_HANDOFF.md` is untracked.
