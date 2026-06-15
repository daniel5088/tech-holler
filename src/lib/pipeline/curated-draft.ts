import { randomUUID } from "node:crypto";
import { getArticles } from "@/lib/content";
import { findDuplicate, hasSuspiciousPhraseReuse } from "@/lib/pipeline/deduplication";
import { normalizeDraftCompleteness } from "@/lib/pipeline/editorial-queue";
import { moderateDraft } from "@/lib/pipeline/openai";
import {
  persistEditorialDraft,
  recentPublishedHeadlines,
  recordJob,
} from "@/lib/pipeline/repository";
import { hasIndependentSources } from "@/lib/pipeline/source-policy";
import type { ArticleDraft } from "@/lib/pipeline/schemas";
import type { Article } from "@/types/content";

function readingTime(sections: { paragraphs: string[] }[]) {
  const words = sections.flatMap((section) => section.paragraphs).join(" ").split(/\s+/).length;
  return Math.max(3, Math.ceil(words / 220));
}

export async function queueCuratedDraft(
  rawDraft: ArticleDraft,
  sourceSnippets: string[] = [],
) {
  const draft = normalizeDraftCompleteness(rawDraft);
  if (!draft) throw new Error("Draft contains an incomplete dek or paragraph");

  const talkLabelInvalid =
    draft.editorialMode === "talk-around-town" &&
    (!draft.title.startsWith("Talk Around Town:") || draft.confidence !== "low");
  if (talkLabelInvalid) {
    throw new Error("Talk Around Town drafts require the title prefix and low confidence");
  }
  if (draft.editorialMode === "reported" && !hasIndependentSources(draft.sources).passes) {
    throw new Error("Reported drafts require independent trustworthy sources");
  }

  const draftText = [
    draft.title,
    draft.dek,
    ...draft.quickTake,
    ...draft.sections.flatMap((section) => [section.heading, ...section.paragraphs]),
  ].join("\n");
  if (hasSuspiciousPhraseReuse(draftText, sourceSnippets)) {
    throw new Error("Potential source phrase reuse detected");
  }
  if (!(await moderateDraft(draft))) throw new Error("Moderation gate failed");

  const existingHeadlines = [
    ...(await recentPublishedHeadlines()),
    ...(await getArticles()).map(({ id, title, slug }) => ({ id, title, slug })),
  ];
  if (findDuplicate(draft.title, existingHeadlines)) {
    throw new Error("Equivalent coverage already exists");
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
    editorialMode: draft.editorialMode,
    uncertaintyNote: draft.editorialMode === "talk-around-town"
      ? draft.uncertaintyNote
      : undefined,
    isBreaking: false,
    trendScore: 0,
    forecastHorizon: draft.forecastHorizon ?? undefined,
    heroImageAlt: draft.heroImageAlt,
    quickTake: draft.quickTake,
    sections: draft.sections,
    sources: draft.sources,
    revisionNote: draft.editorialMode === "talk-around-town"
      ? `Talk Around Town: ${draft.uncertaintyNote}`
      : undefined,
  };

  await persistEditorialDraft(article, {
    method: "human-curated",
    generativeCalls: 0,
    sourceSnippetCount: sourceSnippets.length,
  });
  await recordJob("curated-draft", "completed", {
    draft: { id: article.id, slug: article.slug, title: article.title },
    generativeCalls: 0,
  });
  return article;
}
