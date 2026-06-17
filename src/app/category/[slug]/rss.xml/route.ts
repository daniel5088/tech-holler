import { getCategory } from "@/data/site";
import { getArticles } from "@/lib/content";
import { siteUrl } from "@/lib/env";
import { buildRssFeed } from "@/lib/feeds";
import { SITE_NAME } from "@/data/site";
import type { CategorySlug } from "@/types/content";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const category = getCategory(slug);

  if (!category) {
    return new Response("Not found", { status: 404 });
  }

  const articles = await getArticles({
    category: slug as CategorySlug,
    limit: 50,
  });

  const xml = buildRssFeed({
    title: `${SITE_NAME}: ${category.name}`,
    description: category.description,
    link: `${siteUrl}/category/${category.slug}`,
    selfUrl: `${siteUrl}/category/${category.slug}/rss.xml`,
    articles,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
