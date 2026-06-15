import { randomUUID } from "node:crypto";
import { getArticles } from "@/lib/content";
import { env } from "@/lib/env";
import { findDuplicate, hasSuspiciousPhraseReuse } from "@/lib/pipeline/deduplication";
import {
  moderateDraft,
  researchTrend,
  verifyDraft,
  writeArticle,
  type TokenUsage,
} from "@/lib/pipeline/openai";
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
} from "@/lib/pipeline/trend-scoring";
import type { ResearchPacket } from "@/lib/pipeline/schemas";
import type { ArticleDraft } from "@/lib/pipeline/schemas";
import type { Article, CategorySlug } from "@/types/content";

type UsageRecord = TokenUsage & {
  stage: "research" | "draft" | "verification";
  model: string;
};

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
  const sections = draft.sections.map((section) => ({
    ...section,
    paragraphs: section.paragraphs.map((paragraph) => completeSentencePrefix(paragraph, 80)),
  }));
  if (!dek || sections.some((section) => section.paragraphs.some((paragraph) => !paragraph))) {
    return null;
  }
  return {
    ...draft,
    dek,
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
  const model = env.OPENAI_EDITORIAL_MODEL;
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

  try {
    const { items, errors } = await collectTrendSignals();
    const clusters = clusterTrends(items);
    const candidates = options.category
      ? selectCategoryCandidates(clusters, options.category)
      : selectPublishingCandidates(clusters, "daily");
    const [candidate] = candidates;
    if (!candidate) {
      return finish("blocked", {
        reason: options.category
          ? "No candidate matched the scheduled category"
          : "No candidate passed deterministic preselection",
        signalCount: items.length,
        adapterErrors: errors,
      });
    }

    const rawPacket = await researchTrend(candidate, {
      model,
      maxOutputTokens: env.EDITORIAL_MAX_OUTPUT_TOKENS,
      searchContextSize: "low",
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

    const rawDraft = await writeArticle(effectivePacket, false, undefined, {
      model,
      maxOutputTokens: env.EDITORIAL_MAX_OUTPUT_TOKENS,
      onUsage: addUsage("draft"),
    });
    const draft = normalizeDraftCompleteness(rawDraft);
    if (!draft) {
      return finish("blocked", {
        reason: "Draft contains an incomplete dek or paragraph",
        candidate: { key: candidate.key, label: candidate.label },
      });
    }
    const talkLabelInvalid =
      editorialMode === "talk-around-town" &&
      (!draft.title.startsWith("Talk Around Town:") || draft.confidence !== "low");
    if (draft.editorialMode !== editorialMode || talkLabelInvalid) {
      return finish("blocked", {
        reason: "Editorial mode or label mismatch",
        candidate: { key: candidate.key, label: candidate.label },
      });
    }

    const draftText = draft.sections.flatMap((section) => section.paragraphs).join("\n");
    if (hasSuspiciousPhraseReuse(draftText, effectivePacket.sourceSnippets)) {
      return finish("blocked", {
        reason: "Potential source phrase reuse detected",
        candidate: { key: candidate.key, label: candidate.label },
      });
    }

    const [verification, passesModeration] = await Promise.all([
      verifyDraft(effectivePacket, draft, {
        model,
        maxOutputTokens: 800,
        onUsage: addUsage("verification"),
      }),
      moderateDraft(draft),
    ]);
    if (!verification.passes) {
      return finish("blocked", {
        reason: "Verification failed",
        candidate: { key: candidate.key, label: candidate.label },
        verification,
      });
    }
    if (!passesModeration) {
      return finish("blocked", {
        reason: "Moderation gate failed",
        candidate: { key: candidate.key, label: candidate.label },
      });
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
