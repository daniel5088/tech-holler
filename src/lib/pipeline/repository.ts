import { getServiceSupabase } from "@/lib/supabase";
import { mapArticle, type ArticleRow } from "@/lib/content";
import type { Article, TrendCluster, TrendItem } from "@/types/content";
import type { ResearchPacket } from "@/lib/pipeline/schemas";

export async function persistTrendSweep(items: TrendItem[], clusters: TrendCluster[], errors: unknown[]) {
  const supabase = getServiceSupabase();
  if (!supabase) return { persisted: false, reason: "Supabase not configured" };

  const { error } = await supabase.from("trend_sweeps").insert({
    captured_at: new Date().toISOString(),
    item_count: items.length,
    channel_count: new Set(items.map((item) => item.channel)).size,
    clusters,
    adapter_errors: errors,
  });
  if (error) throw error;
  return { persisted: true };
}

export async function uploadHeroImage(slug: string, base64: string) {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const path = `${new Date().getUTCFullYear()}/${slug}.webp`;
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  const { error } = await supabase.storage
    .from("article-images")
    .upload(path, bytes, { contentType: "image/webp", upsert: true });
  if (error) throw error;
  return supabase.storage.from("article-images").getPublicUrl(path).data.publicUrl;
}

export async function persistArticle(article: Article) {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase must be configured to publish");

  const { error } = await supabase.from("articles").insert({
    id: article.id,
    slug: article.slug,
    title: article.title,
    dek: article.dek,
    category: article.category,
    status: "published",
    published_at: article.publishedAt,
    updated_at: article.updatedAt,
    reading_minutes: article.readingMinutes,
    author: article.author,
    confidence: article.confidence,
    is_breaking: article.isBreaking,
    trend_score: article.trendScore,
    forecast_horizon: article.forecastHorizon,
    hero_image_url: article.heroImageUrl,
    hero_image_alt: article.heroImageAlt,
    quick_take: article.quickTake,
    sections: article.sections,
    sources: article.sources,
    revision_note: article.revisionNote,
  });
  if (error) throw error;

  const { error: sourceError } = await supabase.from("article_sources").insert(
    article.sources.map((source) => ({
      article_id: article.id,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      source_type: source.sourceType,
      published_at: source.publishedAt,
    })),
  );
  if (sourceError) throw sourceError;

  await supabase.from("article_revisions").insert({
    article_id: article.id,
    revision_number: 1,
    reason: "Initial automated publication",
    snapshot: article,
  });
}

function articleRow(article: Article, status: "draft" | "published") {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    dek: article.dek,
    category: article.category,
    status,
    published_at: status === "published" ? article.publishedAt : null,
    updated_at: article.updatedAt,
    reading_minutes: article.readingMinutes,
    author: article.author,
    confidence: article.confidence,
    is_breaking: article.isBreaking,
    trend_score: article.trendScore,
    forecast_horizon: article.forecastHorizon,
    hero_image_url: article.heroImageUrl,
    hero_image_alt: article.heroImageAlt,
    quick_take: article.quickTake,
    sections: article.sections,
    sources: article.sources,
    revision_note: article.revisionNote,
  };
}

export async function persistEditorialDraft(
  article: Article,
  context: Record<string, unknown>,
) {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase must be configured to save an editorial draft");

  const { error } = await supabase.from("articles").insert(articleRow(article, "draft"));
  if (error) throw error;

  const { error: revisionError } = await supabase.from("article_revisions").insert({
    article_id: article.id,
    revision_number: 1,
    reason: "Generated for editorial review",
    snapshot: { article, editorialQueue: context },
  });
  if (revisionError) throw revisionError;
}

export async function getEditorialDrafts(limit = 10) {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ArticleRow[]).map(mapArticle);
}

export async function publishEditorialDraft(id: string) {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase must be configured to publish a draft");

  const { data, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .eq("status", "draft")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Editorial draft not found");

  const article = mapArticle(data as ArticleRow);
  const now = new Date().toISOString();
  const { error: sourceError } = await supabase.from("article_sources").upsert(
    article.sources.map((source) => ({
      article_id: id,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      source_type: source.sourceType,
      published_at: source.publishedAt,
    })),
    { onConflict: "article_id,url", ignoreDuplicates: true },
  );
  if (sourceError) throw sourceError;

  const { error: revisionError } = await supabase.from("article_revisions").upsert(
    {
      article_id: id,
      revision_number: 2,
      reason: "Manually approved for publication",
      snapshot: { ...article, publishedAt: now, updatedAt: now },
    },
    { onConflict: "article_id,revision_number", ignoreDuplicates: true },
  );
  if (revisionError) throw revisionError;

  const { data: published, error: updateError } = await supabase
    .from("articles")
    .update({ status: "published", published_at: now, updated_at: now })
    .eq("id", id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();
  if (updateError) throw updateError;
  if (!published) throw new Error("Draft was not published because its status changed");

  return { ...article, publishedAt: now, updatedAt: now };
}

export async function recentEditorialJobs(limit = 10) {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("job_runs")
    .select("status,details,finished_at")
    .eq("job_type", "editorial-draft")
    .order("finished_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function updatePublishedArticle(article: Article) {
  const supabase = getServiceSupabase();
  if (!supabase) throw new Error("Supabase must be configured to update an article");

  const { error } = await supabase
    .from("articles")
    .update({
      title: article.title,
      dek: article.dek,
      category: article.category,
      updated_at: article.updatedAt,
      reading_minutes: article.readingMinutes,
      confidence: article.confidence,
      is_breaking: article.isBreaking,
      trend_score: article.trendScore,
      forecast_horizon: article.forecastHorizon,
      hero_image_url: article.heroImageUrl,
      hero_image_alt: article.heroImageAlt,
      quick_take: article.quickTake,
      sections: article.sections,
      sources: article.sources,
      revision_note: article.revisionNote,
    })
    .eq("id", article.id);
  if (error) throw error;

  const { error: deleteError } = await supabase
    .from("article_sources")
    .delete()
    .eq("article_id", article.id);
  if (deleteError) throw deleteError;

  const { error: sourceError } = await supabase.from("article_sources").insert(
    article.sources.map((source) => ({
      article_id: article.id,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      source_type: source.sourceType,
      published_at: source.publishedAt,
    })),
  );
  if (sourceError) throw sourceError;

  const { data: latestRevision, error: revisionLookupError } = await supabase
    .from("article_revisions")
    .select("revision_number")
    .eq("article_id", article.id)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (revisionLookupError) throw revisionLookupError;

  const { error: revisionError } = await supabase.from("article_revisions").insert({
    article_id: article.id,
    revision_number: (latestRevision?.revision_number ?? 0) + 1,
    reason: article.revisionNote ?? "Material automated update",
    snapshot: article,
  });
  if (revisionError) throw revisionError;
}

export async function persistResearchPacket(
  trendKey: string,
  packet: ResearchPacket,
  sourceGatePassed: boolean,
) {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  const { error } = await supabase.from("research_packets").insert({
    trend_key: trendKey,
    packet,
    source_gate_passed: sourceGatePassed,
  });
  if (error) throw error;
}

export async function recentPublishedHeadlines(limit = 100) {
  const supabase = getServiceSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("published_articles")
    .select("id,title,slug")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function recordJob(
  jobType: string,
  status: "completed" | "blocked" | "failed",
  details: Record<string, unknown>,
) {
  const supabase = getServiceSupabase();
  if (!supabase) return;
  await supabase.from("job_runs").insert({
    job_type: jobType,
    status,
    slot: typeof details.slot === "string" ? details.slot : null,
    details,
    finished_at: new Date().toISOString(),
  });
}

export async function hasCompletedJobForSlot(jobType: string, slot: string) {
  const supabase = getServiceSupabase();
  if (!supabase) return false;
  const { count, error } = await supabase
    .from("job_runs")
    .select("id", { count: "exact", head: true })
    .eq("job_type", jobType)
    .eq("status", "completed")
    .eq("slot", slot);
  if (error) throw error;
  return (count ?? 0) > 0;
}
