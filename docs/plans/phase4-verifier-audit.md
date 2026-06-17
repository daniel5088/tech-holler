# Phase 4 (F5) — Verifier Calibration Audit

**Status:** Complete — assurance only, **no code change**.
**Date:** 2026-06-16
**Scope:** `VERIFICATION_SYSTEM_PROMPT` (`src/lib/pipeline/anthropic.ts:25-34`) via `verifyDraft`.
**Question:** Is the verifier failing *correct* drafts (false negatives), or are all "Verification failed" blocks justified?

## Method

1. Pulled the block-reason histogram from live `job_runs` (project `ompmgyowsinbjygkkfke`). "Verification failed" is the dominant block: **11** of the verification-eligible blocks.
2. Pulled all 11 `details.verification.report` strings.
3. **Did not rely on the verifier's self-reported reasons alone** (a miscalibrated verifier would still produce plausible-sounding reasons). Instead, ground-truthed the verifier's *premises* against the stored `research_packets` — the independent source of truth for what each claim's `agreement` and source quality actually are.

## Adjudication (all 11)

| Candidate (date) | Verifier reason (summary) | Independent check | Verdict |
|---|---|---|---|
| Kawasaki Robotics (06-16 21:05) | Title truncated ("…I") + platform stated w/o TAT attribution | Mechanical truncation is objective; packet is single-source company item | **Justified** (F2 + F1) |
| Fleetzero PRNewswire (06-16 13:05) | "marine autonomy stack"/"portfolio" implied as settled fact, not self-reported | PR self-announcement packet | **Justified** (F1) |
| Noetix (06-16 09:05) | Unverified launch/giveaway as current news + trailing quickTake cut off | Packet: claim `uncertain`, low/ TAT | **Justified** (F1 + F2) |
| Noetix (06-16 05:05) | Title/dek too settled; overstates corroboration | Packet: `uncertain`, one channel | **Justified** (F1) |
| Noetix (06-15 21:05) | Overstates "first OpenHarmony robot"/"100 free robots" as settled | Packet: `uncertain` | **Justified** (F1) |
| Noetix (06-15 20:52) | States as fact what packet marks unverified/reported | Packet: `uncertain` | **Justified** (F1) |
| Noetix (06-15 20:04) | Broadly compliant; launch/giveaway framed too assertively | Packet: `uncertain`. **Verifier explicitly excused "barnyard buzz" as figurative** | **Justified** (marginal; see note) |
| Erdoğan $10B AI plan (06-15 01:05) | Too casual; leans on uncited analysis; settled-fact framing | Single secondary source | **Justified** (F1) |
| NASA Artemis III (06-14 17:05) | "chatter"/"rumor" misstates source quality; over-sensational | Packet: `uncertain`, low, "weakly supported… unconfirmed" | **Justified** (writer/routing) |
| SpaceX Nasdaq (06-13 20:03) | Overstates unverified Nasdaq trading as quoted fact; **invented quotation-like framing** | Unverified claim | **Justified** (F1 + fabrication) |
| Nature conformation lang. (06-13 19:45) | Dek truncated, ends mid-claim | Mechanical truncation | **Justified** (F2) |

## Findings

- **Zero false negatives.** All 11 failures are true positives. Every "overstated as settled fact" failure is corroborated by the packet marking the claim `agreement: uncertain`. The two truncation failures and the one fabricated-quotation failure are objective, serious defects.
- **The verifier is demonstrably *not* over-strict on voice.** In the 06-15 20:04 Noetix report it explicitly allowed "barnyard buzz" as figurative language and failed only on the literal attribution gap — exactly the designed behavior (grade the proposition under the style, per `anthropic.ts:27-29`).
- **The failures cluster on F1 (self-reported PR claims stated as fact) and F2 (truncation)** — precisely the defects Phases 1–3 target. The audit therefore both clears the verifier and confirms the fixes are aimed correctly.
- One reverse-direction case (NASA): the draft was *too dismissive* ("rumor") of a low-but-real signal. That is an upstream writer/routing concern, not verifier over-strictness.

## Decision

**Do not modify `VERIFICATION_SYSTEM_PROMPT`.** Per the plan's F5 guardrail, the verifier prompt changes only on documented false-negative evidence, and none was found. Throughput must continue to come from better drafts and routing (Phases 1–3), never from loosening the gate.

## Caveat

Blocked runs persist only `candidate` + `verification` (not the draft body), so adjudication used the verifier report against the packet rather than re-reading each draft. This is sufficient to rule out systematic false negatives (packets independently confirm the verifier's premises), but a future enhancement could persist the rejected draft on `blocked` runs to enable full draft-level replay/A-B of any prompt change.
