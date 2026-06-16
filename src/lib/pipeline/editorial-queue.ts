import { randomUUID } from "node:crypto";
import { getArticles } from "@/lib/content";
import { editorialModelName, env } from "@/lib/env";
import { findDuplicate, hasSuspiciousPhraseReuse } from "@/lib/pipeline/deduplication";
import {
  moderateDraft,
  researchTrend,
  verifyDraft,
  writeArticle,
  type TokenUsage,
} from "@/lib/pipeline/anthropic";
import {
  persistArticle,
  persistResearchPacket,
  recentPublishedHeadlines,
  recordJob,
} from "@/lib/pipeline/repository";
import {
  pruneUnsupportedEvidence,
  validateResearchPacket,
  validateTalkAroundTownPacket,
} from "@/lib/pipeline/research-policy";
import { hasIndependentSources } from "@/lib/pipeline/source-policy";
import { collectTrendSignals } from "@/lib/pipeline/adapters";
import {
  clusterTrends,
  selectCategoryCandidates,
  selectPublishingCandidates,
  summarizePreselection,
} from "@/lib/pipeline/trend-scoring";
import type { ResearchPacket } from "@/lib/pipeline/schemas";
import type { ArticleDraft } from "@/lib/pipeline/schemas";
import type { Article, CategorySlug } from "@/types/content";

type UsageRecord = TokenUsage & {
  stage: "research" | "draft" | "verification";
  model: string;
};

// At most two write→verify attempts per run: the original plus one bounded
// repair. Combined with the single research call the ceiling is 5 model calls
// (1 research + 2 draft + 2 verify), reported as callLimit for cost transparency.
const MAX_DRAFT_ATTEMPTS = 2;
const CALL_LIMIT = 1 + MAX_DRAFT_ATTEMPTS * 2;

function readingTime(sections: { paragraphs: string[] }[]) {
  const words = sections.flatMap((section) => section.paragraphs).join(" ").split(/\s+/).length;
  return Math.max(3, Math.ceil(words / 220));
}

function completeSentencePrefix(value: string, minimumLength: number) {
  const trimmed = value.trim();
  if (/[.!?]["')\]]?$/.test(trimmed)) return trimmed;

  const terminalMarks = [...trimmed.matchAll(/[.!?](?=\s|$)/g)];
  const lastMark = terminalMarks.at(-1);
  if (lastMark?.index === undefined) return null;

  const completePrefix = trimmed.slice(0, lastMark.index + 1).trim();
  return completePrefix.length >= minimumLength ? completePrefix : null;
}

export function normalizeDraftCompleteness(draft: ArticleDraft) {
  const dek = completeSentencePrefix(draft.dek, 40);
  const quickTake = draft.quickTake.map((item) => completeSentencePrefix(item, 12));
  const sections = draft.sections.map((section) => ({
    ...section,
    paragraphs: section.paragraphs.map((paragraph) => completeSentencePrefix(paragraph, 80)),
  }));
  if (
    !dek ||
    quickTake.some((item) => !item) ||
    sections.some((section) => section.paragraphs.some((paragraph) => !paragraph))
  ) {
    return null;
  }
  return {
    ...draft,
    dek,
    quickTake: quickTake as string[],
    sections: sections.map((section) => ({
      ...section,
      paragraphs: section.paragraphs as string[],
    })),
  };
}

export async function generateEditorialDraft(
  options: { slot?: string; category?: CategorySlug } = {},
) {
  const usage: UsageRecord[] = [];
  const model = editorialModelName ?? env.ANTHROPIC_EDITORIAL_MODEL;
  const addUsage = (stage: UsageRecord["stage"]) => (record: TokenUsage) => {
    usage.push({ stage, model, ...record });
  };
  const usageSummary = () => ({
    calls: usage.length,
    webSearchCalls: usage.some((record) => record.stage === "research") ? 1 : 0,
    inputTokens: usage.reduce((sum, record) => sum + record.inputTokens, 0),
    outputTokens: usage.reduce((sum, record) => sum + record.outputTokens, 0),
    totalTokens: usage.reduce((sum, record) => sum + record.totalTokens, 0),
    records: usage,
  });
  const finish = async (
    jobStatus: "completed" | "blocked" | "failed",
    details: Record<string, unknown>,
    responseStatus?: "published" | "blocked" | "failed",
  ) => {
    await recordJob("editorial-draft", jobStatus, {
      slot: options.slot,
      category: options.category,
      ...details,
      model,
      callLimit: CALL_LIMIT,
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

  try {
    const { items, errors } = await collectTrendSignals();
    const clusters = clusterTrends(items);
    const candidates = options.category
      ? selectCategoryCandidates(clusters, options.category)
      : selectPublishingCandidates(clusters, "daily");
    const [candidate] = candidates;
    if (!candidate) {
      // A scheduled category slot falls back to the general daily ranking when nothing maps
      // cleanly to the category (selectCategoryCandidates), so an empty result here always
      // means zero clusters cleared daily preselection — never a pure category mismatch.
      // Report the real cause and the preselection breakdown instead of guessing.
      return finish("blocked", {
        reason: "No cluster cleared daily preselection this sweep",
        scheduledCategory: options.category ?? null,
        signalCount: items.length,
        clusterCount: clusters.length,
        preselection: summarizePreselection(clusters, "daily"),
        adapterErrors: errors,
      });
    }

    const rawPacket = await researchTrend(candidate, {
      model,
      maxOutputTokens: env.EDITORIAL_MAX_OUTPUT_TOKENS,
      targetCategory: options.category,
      onUsage: addUsage("research"),
    });
    const packet = pruneUnsupportedEvidence(rawPacket);
    if (!packet) {
      return finish("blocked", {
        reason: "Too few correctly mapped claims remain after evidence cleanup",
        candidate: { key: candidate.key, label: candidate.label },
      });
    }
    const sourceGate = hasIndependentSources(packet.sources);
    const researchGate = validateResearchPacket(packet);
    const talkAroundTownGate = validateTalkAroundTownPacket(packet);
    const hasUncertainClaims = packet.claims.some((claim) => claim.agreement === "uncertain");
    const reportedEligible =
      packet.editorialMode === "reported" &&
      sourceGate.passes &&
      researchGate.passes &&
      !hasUncertainClaims;
    const editorialMode: ResearchPacket["editorialMode"] =
      reportedEligible ? "reported" : "talk-around-town";
    const effectivePacket: ResearchPacket = {
      ...packet,
      editorialMode,
      confidence: editorialMode === "talk-around-town" ? "low" : packet.confidence,
    };

    await persistResearchPacket(candidate.key, effectivePacket, reportedEligible);
    if (!reportedEligible && !talkAroundTownGate.passes) {
      return finish("blocked", {
        reason: "Attribution mapping failed",
        candidate: { key: candidate.key, label: candidate.label },
        talkAroundTownGate,
      });
    }

    // Bounded retry: a single rejection no longer wastes the whole run. On a
    // writer-fixable defect (truncated field, label/mode slip, source phrase
    // reuse, or a failed verification) we feed the specific defect back as
    // repairFeedback and rewrite once more. Moderation and duplicate detection
    // stay hard blocks — they are not corrected by rewriting the same packet.
    const candidateRef = { key: candidate.key, label: candidate.label };
    let draft: ArticleDraft | null = null;
    let repairFeedback: string | undefined;
    let lastBlock: { reason: string; details: Record<string, unknown> } | null = null;

    for (let attempt = 1; attempt <= MAX_DRAFT_ATTEMPTS; attempt += 1) {
      const rawDraft = await writeArticle(effectivePacket, false, repairFeedback, {
        model,
        maxOutputTokens: env.EDITORIAL_MAX_OUTPUT_TOKENS,
        onUsage: addUsage("draft"),
      });
      const normalized = normalizeDraftCompleteness(rawDraft);
      if (!normalized) {
        repairFeedback =
          "A previous draft trailed off mid-clause. Ensure every title, dek, quick-take item, heading, and paragraph is a complete, grammatical sentence that ends with terminal punctuation.";
        lastBlock = {
          reason: "Draft contains an incomplete dek or paragraph",
          details: { candidate: candidateRef },
        };
        continue;
      }
      const talkLabelInvalid =
        editorialMode === "talk-around-town" &&
        (!normalized.title.startsWith("Talk Around Town:") || normalized.confidence !== "low");
      if (normalized.editorialMode !== editorialMode || talkLabelInvalid) {
        repairFeedback =
          editorialMode === "talk-around-town"
            ? "The draft must use editorialMode 'talk-around-town', low confidence, a title beginning exactly with 'Talk Around Town:', and the supplied uncertainty note."
            : "The draft must use editorialMode 'reported' and preserve the supplied uncertainty note.";
        lastBlock = {
          reason: "Editorial mode or label mismatch",
          details: { candidate: candidateRef },
        };
        continue;
      }

      const draftText = normalized.sections.flatMap((section) => section.paragraphs).join("\n");
      if (hasSuspiciousPhraseReuse(draftText, effectivePacket.sourceSnippets)) {
        repairFeedback =
          "The draft reused source phrasing too closely. Use substantially different sentence structure and wording without changing the facts.";
        lastBlock = {
          reason: "Potential source phrase reuse detected",
          details: { candidate: candidateRef },
        };
        continue;
      }

      const [verification, passesModeration] = await Promise.all([
        verifyDraft(effectivePacket, normalized, {
          model,
          maxOutputTokens: 800,
          onUsage: addUsage("verification"),
        }),
        moderateDraft(normalized),
      ]);
      if (!passesModeration) {
        // Not writer-fixable by re-prompting the same packet — hard block now.
        return finish("blocked", {
          reason: "Moderation gate failed",
          candidate: candidateRef,
        });
      }
      if (!verification.passes) {
        repairFeedback = verification.report;
        lastBlock = {
          reason: "Verification failed",
          details: { candidate: candidateRef, verification },
        };
        continue;
      }

      draft = normalized;
      break;
    }

    if (!draft) {
      return finish("blocked", { reason: lastBlock!.reason, ...lastBlock!.details });
    }

    const existingHeadlines = [
      ...(await recentPublishedHeadlines()),
      ...(await getArticles()).map(({ id, title, slug }) => ({ id, title, slug })),
    ];
    const duplicate = findDuplicate(draft.title, existingHeadlines);
    if (duplicate) {
      return finish("blocked", {
        reason: "Equivalent coverage already exists",
        candidate: { key: candidate.key, label: candidate.label },
        duplicate,
      });
    }

    const now = new Date().toISOString();
    const article: Article = {
      id: randomUUID(),
      slug: draft.slug,
      title: draft.title,
      dek: draft.dek,
      category: draft.category,
      publishedAt: now,
      updatedAt: now,
      readingMinutes: readingTime(draft.sections),
      author: "Buckley Byte",
      confidence: draft.confidence,
      editorialMode,
      uncertaintyNote: editorialMode === "talk-around-town"
        ? draft.uncertaintyNote
        : undefined,
      isBreaking: false,
      trendScore: candidate.score,
      forecastHorizon: draft.forecastHorizon ?? undefined,
      heroImageAlt: draft.heroImageAlt,
      quickTake: draft.quickTake,
      sections: draft.sections,
      sources: draft.sources,
      revisionNote: editorialMode === "talk-around-town"
        ? `Talk Around Town: ${draft.uncertaintyNote}`
        : undefined,
    };

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
  } catch (error) {
    return finish("failed", {
      reason: error instanceof Error ? error.message : "Editorial draft generation failed",
    });
  }
}
