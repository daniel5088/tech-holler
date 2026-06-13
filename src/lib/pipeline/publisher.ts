import { randomUUID } from "node:crypto";
import { getArticleBySlug, getArticles } from "@/lib/content";
import { findDuplicate, hasSuspiciousPhraseReuse } from "@/lib/pipeline/deduplication";
import { generateHeroImage, moderateDraft, researchTrend, verifyDraft, writeArticle } from "@/lib/pipeline/openai";
import {
  persistArticle,
  persistResearchPacket,
  recentPublishedHeadlines,
  updatePublishedArticle,
  uploadHeroImage,
} from "@/lib/pipeline/repository";
import { validateResearchPacket } from "@/lib/pipeline/research-policy";
import { hasIndependentSources } from "@/lib/pipeline/source-policy";
import type { Article, TrendCluster } from "@/types/content";

function readingTime(sections: { paragraphs: string[] }[]) {
  const words = sections.flatMap((section) => section.paragraphs).join(" ").split(/\s+/).length;
  return Math.max(3, Math.ceil(words / 220));
}

export async function produceArticle(cluster: TrendCluster, isBreaking: boolean) {
  const packet = await researchTrend(cluster);
  const sourceGate = hasIndependentSources(packet.sources);
  const researchGate = validateResearchPacket(packet);
  await persistResearchPacket(cluster.key, packet, sourceGate.passes && researchGate.passes);
  if (!sourceGate.passes) {
    return { status: "blocked" as const, reason: "Independent source gate failed", sourceGate };
  }
  if (!researchGate.passes) {
    return {
      status: "blocked" as const,
      reason: "Research evidence mapping failed",
      researchGate,
    };
  }
  if (packet.claims.some((claim) => claim.agreement === "uncertain")) {
    return { status: "blocked" as const, reason: "Research contains uncertain factual claims" };
  }

  let draft = await writeArticle(packet, isBreaking);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const draftText = draft.sections.flatMap((section) => section.paragraphs).join("\n");
    if (hasSuspiciousPhraseReuse(draftText, packet.sourceSnippets)) {
      if (attempt < 2) {
        draft = await writeArticle(
          packet,
          isBreaking,
          "The draft reused source phrasing too closely. Use substantially different sentence structure and wording.",
        );
        continue;
      }
      return { status: "blocked" as const, reason: "Potential source phrase reuse detected" };
    }

    const [verification, passesModeration] = await Promise.all([
      verifyDraft(packet, draft),
      moderateDraft(draft),
    ]);
    if (!verification.passes) {
      if (attempt < 2) {
        draft = await writeArticle(packet, isBreaking, verification.report);
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

  let heroImageUrl: string | undefined;
  try {
    const image = await generateHeroImage(draft.heroImagePrompt);
    if (image) heroImageUrl = (await uploadHeroImage(draft.slug, image)) ?? undefined;
  } catch (error) {
    console.error("Hero generation failed; deterministic site art will be used.", error);
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
    isBreaking,
    trendScore: cluster.score,
    forecastHorizon: draft.forecastHorizon ?? undefined,
    heroImageUrl: heroImageUrl ?? existingArticle?.heroImageUrl,
    heroImageAlt: draft.heroImageAlt,
    quickTake: draft.quickTake,
    sections: draft.sections,
    sources: draft.sources,
    revisionNote: existingArticle
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
