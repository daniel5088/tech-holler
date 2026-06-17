import { getArticles } from "@/lib/content";
import {
  NEWS_SITEMAP_MAX_URLS,
  buildNewsSitemap,
  newsEligibleArticles,
} from "@/lib/feeds";

export const dynamic = "force-dynamic";

export async function GET() {
  const articles = await getArticles({ limit: NEWS_SITEMAP_MAX_URLS });
  const eligible = newsEligibleArticles(articles);

  const xml = buildNewsSitemap(eligible);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
    },
  });
}
