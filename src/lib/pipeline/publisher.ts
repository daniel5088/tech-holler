import { randomUUID } from "node:crypto";
import { getArticleBySlug, getArticles } from "@/lib/content";
import { findDuplicate, hasSuspiciousPhraseReuse } from "@/lib/pipeline/deduplication";
import { moderateDraft, researchTrend, verifyDraft, writeArticle } from "@/lib/pipeline/anthropic";
import {
  persistArticle,
  persistResearchPacket,
  recentPublishedHeadlines,
  updatePublishedArticle,
} from "@/lib/pipeline/repository";
import {
  validateResearchPacket,
  validateTalkAroundTownPacket,
} from "@/lib/pipeline/research-policy";
import { hasIndependentSources } from "@/lib/pipeline/source-policy";
import type { ResearchPacket } from "@/lib/pipeline/schemas";
import type { Article, TrendCluster } from "@/types/content";

function readingTime(sections: { paragraphs: string[] }[]) {
  const words = sections.flatMap((section) => section.paragraphs).join(" ").split(/\s+/).length;
  return Math.max(3, Math.ceil(words / 220));
}

export async function produceArticle(cluster: TrendCluster, isBreaking: boolean) {
  const packet = await researchTrend(cluster);
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
  const effectivePacket = {
    ...packet,
    editorialMode,
    confidence: editorialMode === "talk-around-town" ? "low" as const : packet.confidence,
  };

  await persistResearchPacket(cluster.key, effectivePacket, reportedEligible);
  if (!reportedEligible && !talkAroundTownGate.passes) {
    return {
      status: "blocked" as const,
      reason: "Talk Around Town attribution gate failed",
      sourceGate,
      researchGate,
      talkAroundTownGate,
    };
  }

  let draft = await writeArticle(effectivePacket, isBreaking && reportedEligible);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const talkLabelInvalid =
      editorialMode === "talk-around-town" &&
      (!draft.title.startsWith("Talk Around Town:") || draft.confidence !== "low");
    if (draft.editorialMode !== editorialMode || talkLabelInvalid) {
      if (attempt < 2) {
        draft = await writeArticle(
          effectivePacket,
          isBreaking && reportedEligible,
          editorialMode === "talk-around-town"
            ? "The draft must use editorialMode 'talk-around-town', low confidence, a title beginning exactly with 'Talk Around Town:', and the supplied uncertainty note."
            : "The draft must use editorialMode 'reported' and preserve the supplied uncertainty note.",
        );
        continue;
      }
      return { status: "blocked" as const, reason: "Editorial mode or label mismatch" };
    }
    const draftText = draft.sections.flatMap((section) => section.paragraphs).join("\n");
    if (hasSuspiciousPhraseReuse(draftText, effectivePacket.sourceSnippets)) {
      if (attempt < 2) {
        draft = await writeArticle(
          effectivePacket,
          isBreaking && reportedEligible,
          "The draft reused source phrasing too closely. Use substantially different sentence structure and wording.",
        );
        continue;
      }
      return { status: "blocked" as const, reason: "Potential source phrase reuse detected" };
    }

    const [verification, passesModeration] = await Promise.all([
      verifyDraft(effectivePacket, draft),
      moderateDraft(draft),
    ]);
    if (!verification.passes) {
      if (attempt < 2) {
        draft = await writeArticle(
          effectivePacket,
          isBreaking && reportedEligible,
          verification.report,
        );
        continue;
      }
      return { status: "blocked" as const, reason: "Factual verification failed", verification };
    }
    if (!passesModeration) {
      return { status: "blocked" as const, reason: "Moderation gate failed" };
    }
    break;
  }

  const existingHeadlines = [
    ...(await recentPublishedHeadlines()),
    ...(await getArticles()).map(({ id, title, slug }) => ({ id, title, slug })),
  ];
  const duplicate = findDuplicate(draft.title, existingHeadlines);
  if (duplicate && !isBreaking) {
    return {
      status: "blocked" as const,
      reason: "Equivalent coverage already exists",
      duplicate,
    };
  }

  const now = new Date().toISOString();
  const existingArticle = duplicate
    ? await getArticleBySlug(duplicate.article.slug)
    : null;
  const article: Article = {
    id: existingArticle?.id ?? randomUUID(),
    slug: existingArticle?.slug ?? draft.slug,
    title: draft.title,
    dek: draft.dek,
    category: draft.category,
    publishedAt: existingArticle?.publishedAt ?? now,
    updatedAt: now,
    readingMinutes: readingTime(draft.sections),
    author: "Buckley Byte",
    confidence: draft.confidence,
    editorialMode,
    uncertaintyNote: editorialMode === "talk-around-town"
      ? draft.uncertaintyNote
      : undefined,
    isBreaking: isBreaking && reportedEligible,
    trendScore: cluster.score,
    forecastHorizon: draft.forecastHorizon ?? undefined,
    heroImageUrl: existingArticle?.heroImageUrl,
    heroImageAlt: draft.heroImageAlt,
    quickTake: draft.quickTake,
    sections: draft.sections,
    sources: draft.sources,
    revisionNote: editorialMode === "talk-around-town"
      ? `Talk Around Town: ${draft.uncertaintyNote}`
      : existingArticle
        ? "Updated automatically after a newly verified breaking development."
        : undefined,
  };

  if (existingArticle) {
    await updatePublishedArticle(article);
    return { status: "updated" as const, article, previousSlug: existingArticle.slug };
  }

  await persistArticle(article);
  return { status: "published" as const, article };
}
