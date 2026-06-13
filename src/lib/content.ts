import { demoArticles } from "@/data/demo-articles";
import { getServiceSupabase } from "@/lib/supabase";
import type { Article, CategorySlug } from "@/types/content";

export type ArticleRow = {
  id: string;
  slug: string;
  title: string;
  dek: string;
  category: CategorySlug;
  published_at: string | null;
  updated_at: string;
  reading_minutes: number;
  author: string;
  confidence: Article["confidence"];
  is_breaking: boolean;
  trend_score: number;
  forecast_horizon: string | null;
  hero_image_url: string | null;
  hero_image_alt: string;
  quick_take: string[];
  sections: Article["sections"];
  sources: Article["sources"];
  revision_note: string | null;
  created_at: string;
};

const TALK_AROUND_TOWN_PREFIX = "Talk Around Town: ";

export function mapArticle(row: ArticleRow): Article {
  const isTalkAroundTown = row.revision_note?.startsWith(TALK_AROUND_TOWN_PREFIX) ?? false;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    dek: row.dek,
    category: row.category,
    publishedAt: row.published_at ?? row.created_at,
    updatedAt: row.updated_at,
    readingMinutes: row.reading_minutes,
    author: row.author,
    confidence: row.confidence,
    editorialMode: isTalkAroundTown ? "talk-around-town" : "reported",
    uncertaintyNote: isTalkAroundTown
      ? row.revision_note?.slice(TALK_AROUND_TOWN_PREFIX.length)
      : undefined,
    isBreaking: row.is_breaking,
    trendScore: row.trend_score,
    forecastHorizon: row.forecast_horizon ?? undefined,
    heroImageUrl: row.hero_image_url ?? undefined,
    heroImageAlt: row.hero_image_alt,
    quickTake: row.quick_take,
    sections: row.sections,
    sources: row.sources,
    revisionNote: row.revision_note ?? undefined,
  };
}

export async function getArticles(options?: {
  category?: CategorySlug;
  limit?: number;
  query?: string;
}): Promise<Article[]> {
  const supabase = getServiceSupabase();

  if (!supabase) {
    let articles = [...demoArticles];
    if (options?.category) {
      articles = articles.filter((article) => article.category === options.category);
    }
    if (options?.query) {
      const query = options.query.toLowerCase();
      articles = articles.filter(
        (article) =>
          article.title.toLowerCase().includes(query) ||
          article.dek.toLowerCase().includes(query),
      );
    }
    return articles.slice(0, options?.limit ?? articles.length);
  }

  let query = supabase
    .from("published_articles")
    .select("*")
    .order("published_at", { ascending: false });

  if (options?.category) {
    query = query.eq("category", options.category);
  }
  if (options?.query) {
    query = query.textSearch("search_document", options.query, {
      type: "websearch",
    });
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Falling back to demonstration content:", error.message);
    return demoArticles.slice(0, options?.limit ?? demoArticles.length);
  }
  return (data as ArticleRow[]).map(mapArticle);
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return demoArticles.find((article) => article.slug === slug) ?? null;
  }

  const { data, error } = await supabase
    .from("published_articles")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Article lookup failed:", error.message);
    return demoArticles.find((article) => article.slug === slug) ?? null;
  }
  return data ? mapArticle(data as ArticleRow) : null;
}

export async function getArticleSlugs() {
  const articles = await getArticles();
  return articles.map((article) => article.slug);
}
