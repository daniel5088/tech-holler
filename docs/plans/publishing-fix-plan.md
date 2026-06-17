# Publishing Fix Plan — Get Articles Posting Again

**Status:** Plan / design only. No code changes in this document.
**Date:** 2026-06-16
**Owner:** Editorial pipeline
**Scope:** The live daily auto‑publish path (`/api/cron/daily` → `generateEditorialDraft`). The breaking path is intentionally disabled and the `runPublishingJob`/`produceArticle` path is unwired (see §6).

---

## 1. Diagnostic baseline (from live production Supabase)

Infrastructure is **healthy** — this is not an infra/config problem:

- All 3 pg_cron jobs active and succeeding; `net._http_response` returns 200.
- Trend sweeps capturing ~129 signals / 128 clusters, **no adapter errors**.
- Vault secrets present; `PUBLISHING_ENABLED` on; `CRON_SECRET` matches; Anthropic key now valid (the 2 `"ANTHROPIC_API_KEY is not configured"` failures on 2026‑06‑15 are resolved).

The bottleneck is **content quality gates**, not plumbing. Last ~18 `editorial-draft` runs:

| Outcome | Count | Reason |
|---|---|---|
| blocked | 15 | ~10 **Verification failed** (dominant), 3 "No candidate matched the scheduled category", 1 "Too few correctly mapped claims remain after evidence cleanup", 1 "Attribution mapping failed" |
| failed | 2 | `ANTHROPIC_API_KEY is not configured` (resolved) |
| completed | 1 | published |

Total published ever: 2 (latest 2026‑06‑15).

**Two structural patterns in the verification reports (verbatim):**

1. *Self‑reported PR claims asserted as fact.* Fleetzero PRNewswire item — "the quick‑take and body go a bit beyond the packet by implying 'marine autonomy stack' and 'expanding its marine technology portfolio' as settled facts rather than clearly self‑reported claims throughout." Noetix item — "title/dek still read a bit too settled for a talk‑around‑town item and the piece overstates corroboration."
2. *Mechanical truncation defect.* Noetix item — "the trailing quickTake item is cut off/incomplete." This alone fails the run.

Candidates are largely PR‑newswire / company self‑announcements. The writer presents self‑reported claims as settled fact, and a recurring trailing‑`quickTake` truncation independently fails drafts.

---

## 2. Guiding principles & guardrails

> **Do not weaken the safety gates to force publishing.** The verifier is doing its job. Every fix below moves quality *upstream* (better writing, better sourcing, deterministic format checks) or adds *bounded retries* — none of them lower the bar for what may be published.

- **Fix the writer, not the gate.** When the verifier and the writer disagree, change the writer/prompt so the draft is actually correct, not the verifier so it tolerates incorrect drafts.
- **Prefer deterministic guards over model judgment** for mechanical defects (truncation, label format). They are cheaper, faster, and don't consume the one verification call.
- **Talk‑Around‑Town is the pressure valve, not a loophole.** Routing PR/self‑announcements to TAT/low‑confidence is correct *because the attribution actually changes*, not to sneak weak stories through. The TAT attribution gate (`validateTalkAroundTownPacket`) and the verifier still apply.
- **Each change is independently revertable** and ordered low‑risk → higher‑risk.

---

## 3. Root‑cause map (problem → code)

| # | Symptom | Root cause location | Gate that fails |
|---|---|---|---|
| F1 | "go beyond the packet… settled facts rather than self‑reported" | Writer system prompt in `writeArticle` (`anthropic.ts:203` / `:226`) under‑specifies attribution for PR/self‑sourced claims | `verifyDraft` → `produceArticle`/`generateEditorialDraft` "Verification failed" |
| F2 | "trailing quickTake item is cut off/incomplete" | `normalizeDraftCompleteness` (`editorial-queue.ts:56-73`) validates `dek` + section `paragraphs` only — **`quickTake` is never checked**; schema only enforces `min(12)` chars (`schemas.ts:64`) | `verifyDraft` "Verification failed" |
| F3 | "No candidate matched the scheduled category" (×3) | Misleading message at `editorial-queue.ts:120-128`; real condition is empty `selectPublishingCandidates(...,"daily")` — the `vaguePenalty = 35` when `specificNewsSignals === 0` (`trend-scoring.ts:204`) plus thresholds (`score>=40 && factualSignals>=1 && selectionScore>=45`, `:249-253`) | Gate E (no candidate) |
| F4 | One verification fail → whole run blocked | Live path `generateEditorialDraft` is **single‑shot** (`callLimit: 3`, no retry loop). The retry‑capable `produceArticle` (`publisher.ts:55-104`) is **dead code** — only imported by `run.ts`/`run.test.ts`, wired to no route | All content gates, no second attempt |
| F5 | Verifier possibly over/under‑strict | `VERIFICATION_SYSTEM_PROMPT` (`anthropic.ts:25-34`) | n/a — calibration check only |
| (resolved) | `ANTHROPIC_API_KEY is not configured` | `anthropicClient()` (`anthropic.ts:42-45`) | already fixed |

---

## 4. Phased fix plan

Ordered by **leverage ÷ risk**. Phase 1 is low‑risk and addresses the **majority** of blocks (dominant "Verification failed" + the mechanical truncation). Phases 2–3 address the long tail and resilience.

### Phase 1 — Writer correctness & format (low risk, highest leverage)

#### F1. Writer must attribute self‑reported / PR claims throughout

- **Problem.** For PR‑newswire / company self‑announcements, the writer states company claims ("marine autonomy stack", "expanding its marine technology portfolio") as settled fact. The verifier correctly fails this.
- **Root cause.** The writer system prompt (`writeArticle`, `anthropic.ts:203` OpenAI / `:226` Anthropic — identical text) tells the model to "keep every uncertain assertion attributed," but does not give explicit handling for the *single‑source / self‑reported / marketing* case that dominates the candidate pool. The research packet already carries `editorialMode`, `sourceAssessment`, and per‑claim `agreement` (`schemas.ts:41`), but the prompt doesn't force the writer to *map a self‑reported claim to persistent in‑line attribution* ("the company says…", "according to NoetixRobotics' announcement…").
- **Proposed change (prompt‑only).** Extend the `writeArticle` system prompt (both provider branches, keep them identical) with an explicit rule block:
  - Any claim whose support is a company/press release/self‑announcement, or whose packet `agreement` is not `confirmed`, **must** be attributed in‑line *every time it appears* — in the title, dek, quickTake, headings, and body — using phrasing like "the company says", "according to <source>", "<company> claims". Never restate it as an unattributed fact.
  - Marketing language ("portfolio", "stack", "platform", capability claims) describing the announcer's own product must be framed as the company's description, not the publication's assertion.
  - The dek and quickTake carry the same attribution burden as the body (these are the fields the verifier is flagging).
- **Why prompt‑first.** No gate weakened; the draft becomes *actually* correct, so the existing verifier passes it honestly.
- **Risk.** Low. Worst case the prose gets more hedged/verbose; voice may stiffen slightly. Mitigated by keeping the Alabama‑voice instruction intact and instructing that attribution be woven into the voice, not bolted on.
- **Validation.**
  - Dry‑run: re‑run `generateEditorialDraft` (admin "generate" or `POST /api/cron/daily?force=true&category=…`) against the Fleetzero and Noetix candidates that previously failed; expect `verifyDraft` to return `PASS`.
  - Inspect the draft: confirm self‑reported claims read as attributed in dek + quickTake.
  - Watch `job_runs`: "Verification failed" share of blocks should drop materially.

#### F2. Fix the truncated/incomplete trailing `quickTake`

- **Problem.** The third `quickTake` item is frequently cut off mid‑clause; this alone fails verification.
- **Root cause.** `normalizeDraftCompleteness` (`editorial-queue.ts:56-73`) only runs `completeSentencePrefix` over `draft.dek` and each section paragraph. **`quickTake`, `title`, and `heading` are never completeness‑checked.** The schema (`schemas.ts:64`) only requires `quickTake` items to be `min(12)/max(180)` chars and `.length(3)` — a 40‑char item that trails off "…and the 100‑developer giveaway" passes the schema and the normalizer, then dies at the verifier. (It is *not* a hard `max_tokens` cutoff: a token‑limit truncation would break the structured‑output JSON and throw "Writing model returned no structured article" → a `failed` run, not the observed `blocked`. The model is stylistically trailing off within the field.)
- **Proposed change (deterministic guard).** Extend `normalizeDraftCompleteness` to also enforce completeness of `quickTake` items (and, cheaply, `title`/`heading`):
  - Run each `quickTake` item through the same `completeSentencePrefix` logic (with a suitable `minimumLength`, e.g. 12 to match the schema floor). quickTake items are short fragments and may legitimately lack terminal punctuation, so prefer a *fragment‑complete* check: reject only items that end mid‑word or with a dangling conjunction/comma, rather than requiring a full stop.
  - If an item cannot be salvaged to a complete fragment, return `null` (consistent with current behavior for incomplete dek/paragraph) so the run is recorded `blocked` deterministically with a precise reason — **or**, better, combine with F4 to trigger a bounded rewrite rather than a hard block.
  - Optionally tighten the schema (`schemas.ts:64`) to forbid trailing connectors, but keep the runtime guard as the primary fix (schema regex for "complete fragment" is brittle).
- **Risk.** Very low — deterministic, no model call. Slight risk of over‑rejecting legitimately punctuation‑free bullets; mitigate by checking for *truncation markers* (trailing `,`/`and`/`the`/`to`/mid‑word) rather than requiring sentence‑final punctuation.
- **Validation.**
  - Unit‑style: feed the known Noetix draft (truncated 3rd bullet) through the updated normalizer; expect rejection/repair, not pass‑through.
  - Confirm a clean draft with three complete bullets passes unchanged.
  - After deploy, the "trailing quickTake cut off" verifier reports should disappear from `job_runs.details.verification`.

**Phase 1 exit criteria:** on a re‑run against the last ~10 failing candidates, "Verification failed" blocks attributable to (a) un‑attributed PR claims and (b) truncated quickTake are gone; overall block rate drops; no new `failed` runs introduced.

---

### Phase 2 — Candidate sourcing & category mapping (medium risk)

#### F3. Route PR/self‑announcements correctly and fix the misleading "no candidate" block

- **Problem A (mislabeled block).** "No candidate matched the scheduled category" appeared 3×. The message implies a category‑matching failure, but `selectCategoryCandidates` (`trend-scoring.ts:272-282`) already falls back to the general daily ranking (`matched.length ? matched : daily`). The block at `editorial-queue.ts:120-128` therefore only fires when `selectPublishingCandidates(clusters, "daily")` is itself **empty** — i.e. *no cluster cleared daily preselection at all*, not a category mismatch.
- **Root cause A.** Daily preselection (`trend-scoring.ts:249-253`) requires `score>=40 && factualSignals>=1 && selectionScore>=45`. `selectionScore` subtracts `vaguePenalty = 35` whenever `specificNewsSignals === 0` (`:204`) and `discoveryPenalty = 30` for discovery‑only clusters (`:205`). With a PR/social‑heavy signal mix, many clusters land below 45 and the whole slot yields zero candidates.
- **Problem B (sourcing).** Even when a candidate is selected, it's typically a single‑source PR item that *should* be Talk‑Around‑Town / low confidence, but is entering as `reported` and then failing the source/verification gates.
- **Proposed changes.**
  1. **Honest diagnostics first (no behavior change):** change the block reason text at `editorial-queue.ts:121-127` to distinguish "no cluster cleared daily preselection" from "candidates existed but none classified into the scheduled category." This makes future `job_runs` self‑explanatory and tells us whether F3 is a sourcing problem or a scoring‑threshold problem before we tune anything.
  2. **Bias PR/self‑announcement candidates toward Talk‑Around‑Town at the policy layer**, not by lowering gates: in the `reportedEligible` computation (`editorial-queue.ts:147-151`), the existing requirement already demands `hasIndependentSources` + `validateResearchPacket` + no uncertain claims. Confirm a single‑domain PR packet *correctly* falls to `talk-around-town` (it should, since `hasIndependentSources` requires `domains.size >= 1 && hasAuthoritativeSource` and a lone PRNewswire/company domain that isn't trusted fails `isTrustedDomain`). If PR items are slipping through as `reported`, tighten the research **prompt** (`researchTrend`, `anthropic.ts:129`/`:168`) to instruct: treat a single company/press‑release source as `talk-around-town`, and require ≥2 *independent, non‑self* trusted domains for `reported`.
  3. **Optionally relax the daily‑preselection floor *carefully*** so PR/self clusters still surface as TAT candidates instead of starving the slot: e.g. allow a cluster with `factualSignals >= 1` to pass at a lower `selectionScore` *when it will be routed to TAT*. This does **not** weaken publication gates — TAT drafts still face the attribution gate and verifier. Treat this as the last lever and only if diagnostics (change 1) show genuine candidate starvation rather than downstream failure.
  4. **Consider a source allowlist / corroboration requirement** using the existing `SOURCE_ALLOWLIST` env (`env.ts:25`) and `DEFAULT_TRUSTED_DOMAINS` (`source-policy.ts:3-54`): require at least one independent trusted domain beyond the announcer for `reported`. PRNewswire/Businesswire/GlobeNewswire and bare company domains are not in the trusted list, so this largely already holds — verify rather than rebuild.
- **Risk.** Medium. Threshold/prompt tuning can over‑ or under‑select; TAT volume may rise. Mitigate by shipping change 1 (diagnostics) alone first, observing a few cycles, then tuning.
- **Validation.**
  - After change 1: read `job_runs.details.reason` and confirm the new wording correctly attributes the block; quantify how many "no candidate" events are starvation vs. category mismatch.
  - After changes 2–4: re‑run the six category slots via `?force=true&category=…`; confirm PR items arrive as `talk-around-town` with low confidence and pass the TAT attribution gate + verifier; confirm slots no longer return zero candidates.
  - Monitor the ratio of `reported` vs `talk-around-town` publications and the block‑reason histogram.

---

### Phase 3 — Resilience: bounded retry on verification failure (medium risk)

#### F4. Add a bounded retry to the live path (or wire the existing retry path)

- **Problem.** A single verification failure blocks the entire run with no second attempt, even though `verifyDraft` returns an actionable `report` that `writeArticle` already knows how to consume via `repairFeedback` (`anthropic.ts:191`, `:209`/`:232`).
- **Root cause.** The **live** path `generateEditorialDraft` (`editorial-queue.ts:75-278`) calls `writeArticle` once and `verifyDraft` once (`callLimit: 3`). The path that *does* retry — `produceArticle` (`publisher.ts:55-104`, up to 2 `writeArticle` attempts feeding `verification.report` back in) — is **dead code**: imported only by `run.ts` (`runPublishingJob`) and `run.test.ts`, and `runPublishingJob` is wired to **no route** (breaking is disabled, daily uses `generateEditorialDraft`).
- **Decision: add a small, explicit retry loop to `generateEditorialDraft`** rather than resurrecting `runPublishingJob`. Rationale: `produceArticle` lacks the editorial‑queue features the live path needs (`normalizeDraftCompleteness`, `pruneUnsupportedEvidence`, usage accounting, `recordJob` shape, category targeting). Porting the queue into `produceArticle` is more work and risk than adding a bounded loop where the logic already lives.
- **Proposed change.**
  - Wrap the write→checks→verify segment (`editorial-queue.ts:169-219`) in a loop of **at most 2 attempts**. On the first `verifyDraft` failure (or an F2 truncation rejection, or a phrase‑reuse / label rejection), call `writeArticle(effectivePacket, false, <feedback>, …)` again with the verifier `report` / specific defect as `repairFeedback`, then re‑verify. After the second failure, record `blocked` as today.
  - Update the recorded `callLimit` and `usage` accounting so the extra calls are visible in `job_runs.details.usage` (cost transparency).
  - Keep `EDITORIAL_MAX_OUTPUT_TOKENS` and the 800‑token verify budget unchanged.
  - **Clean up the dead path:** either delete `run.ts`/`publisher.ts` (+ their tests) or add a header comment marking them unwired, so future readers don't assume retries are live. (Design note only — do not delete without sign‑off; `run.test.ts` currently passes and documents intended retry semantics worth preserving as reference.)
- **Risk.** Medium — doubles model spend on hard candidates (bounded to ×2). One extra write + verify per retried run. Mitigate with the hard cap of 2 attempts and usage logging; consider only retrying on *verification* failures (most recoverable) initially, not on every gate.
- **Validation.**
  - Re‑run a candidate that fails verification on attempt 1 for a fixable reason; confirm attempt 2 passes and publishes.
  - Confirm a genuinely unsupported candidate still ends `blocked` after 2 attempts (gate integrity preserved).
  - Track `job_runs.details.usage.calls` to confirm the cap holds and watch token‑cost delta.

---

### Phase 4 — Verifier calibration check (assurance, not a change)

#### F5. Confirm the verifier isn't over‑strict — but bias toward fixing the writer

- **Problem.** We must rule out that `VERIFICATION_SYSTEM_PROMPT` (`anthropic.ts:25-34`) is failing *correct* drafts (false negatives), while not loosening it for incorrect ones.
- **Approach (audit, mostly no‑code).**
  - Take 5–10 recent `blocked` drafts + their `verification.report` from `job_runs` and adjudicate by hand: is each failure *justified*? The verbatim examples we have (settled‑fact framing, truncated bullet) are **correct** failures, which argues the verifier is calibrated.
  - Only if we find clear false negatives (a properly attributed, complete TAT draft failing) do we touch the verifier prompt — and then we *clarify*, not weaken (e.g. make explicit that correctly attributed self‑reported claims PASS), never remove the "do not excuse invented or overstated facts" clause (`anthropic.ts:30`).
- **Risk.** Low (audit). Any prompt edit here is the highest‑risk‑to‑safety change in the plan and must be gated behind documented false‑negative evidence.
- **Validation.** A/B the verifier on a labeled set of known‑good and known‑bad drafts; require that known‑bad drafts still FAIL after any edit.

---

## 5. Rollout sequence & monitoring

1. **Phase 1 (F1 + F2)** — ship together; prompt + deterministic normalizer. Highest leverage, lowest risk. Validate by forced re‑runs against the Fleetzero/Noetix candidates and a 1–2 day watch of `job_runs` block reasons.
2. **Phase 2 (F3)** — ship the **diagnostic wording change first**, observe ≥6 category cycles (≈1 day), then tune sourcing/thresholds only if data shows candidate starvation.
3. **Phase 3 (F4)** — add bounded retry once Phase 1 has reduced the *rate* of failures (so retries are cheap and rare, not masking a broken writer).
4. **Phase 4 (F5)** — continuous audit; only act on documented false negatives.

**Standing monitoring queries (Supabase):**

```sql
-- Block-reason histogram over recent runs
select status, details->>'reason' as reason, count(*)
from job_runs
where job_type = 'editorial-draft'
group by 1, 2
order by 3 desc;

-- Verification reports for the latest blocks
select finished_at, details->'candidate'->>'label' as candidate,
       details->'verification'->>'report' as report
from job_runs
where job_type = 'editorial-draft' and status = 'blocked'
order by finished_at desc limit 20;

-- Publication rate and cost
select status, details->'usage'->>'calls' as calls,
       details->'usage'->>'totalTokens' as tokens, finished_at
from job_runs
where job_type = 'editorial-draft'
order by finished_at desc limit 30;

-- Reported vs Talk-Around-Town mix among published
select editorial_mode, confidence, count(*)
from published_articles group by 1, 2;
```

**Success metric:** ≥1 successful publication per active category slot/day, with "Verification failed" no longer the dominant block reason, and **zero** weakening of `verifyDraft` / `hasIndependentSources` / the TAT attribution gate.

---

## 6. Non‑goals / explicit guardrails

- **Do not** lower or remove any check in `verifyDraft`, `validateResearchPacket`, `validateTalkAroundTownPacket`, `hasIndependentSources`, or `pruneUnsupportedEvidence` to raise throughput. Throughput comes from better drafts and better routing.
- **Do not** publish unsupported claims by relaxing the `reported` eligibility (`editorial-queue.ts:147-151`). Weak/PR stories go to Talk‑Around‑Town with low confidence and full attribution, or they don't publish.
- **Do not** re‑enable the breaking path or wire `runPublishingJob` as part of this fix — out of scope; the daily editorial path is the target.
- **Do not** raise `EDITORIAL_MAX_OUTPUT_TOKENS` as a "fix" for truncation — the truncation is a missing completeness check (F2), not a token‑budget exhaustion.

---

## 7. File/function index (for implementers)

- Writer prompt & calls: `src/lib/pipeline/anthropic.ts` — `writeArticle` (`:188`), `researchTrend` (`:100`), `verifyDraft` (`:244`), `VERIFICATION_SYSTEM_PROMPT` (`:25`), `moderateDraft` (`:292`).
- Live publish flow + completeness guard: `src/lib/pipeline/editorial-queue.ts` — `generateEditorialDraft` (`:75`), `normalizeDraftCompleteness` (`:56`).
- Schemas (quickTake/dek constraints): `src/lib/pipeline/schemas.ts` — `articleDraftSchema` (`:53`), `quickTake` (`:64`).
- Candidate scoring/selection: `src/lib/pipeline/trend-scoring.ts` — `selectPublishingCandidates` (`:242`), `selectCategoryCandidates` (`:272`), penalties (`:204-205`).
- Policy gates: `src/lib/pipeline/research-policy.ts` (`pruneUnsupportedEvidence`, `validateResearchPacket`, `validateTalkAroundTownPacket`), `src/lib/pipeline/source-policy.ts` (`hasIndependentSources`, `DEFAULT_TRUSTED_DOMAINS`).
- Dead/unwired retry path (decision in F4): `src/lib/pipeline/run.ts` (`runPublishingJob`), `src/lib/pipeline/publisher.ts` (`produceArticle`).
- Persistence/audit: `src/lib/pipeline/repository.ts` — `persistArticle` (`:33`), `recordJob` (`:292`).
