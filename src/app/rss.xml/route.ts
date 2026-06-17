import { getArticles } from "@/lib/content";
import { siteUrl } from "@/lib/env";
import { buildRssFeed } from "@/lib/feeds";
import { SITE_DESCRIPTION, SITE_NAME } from "@/data/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const articles = await getArticles({ limit: 50 });

  const xml = buildRssFeed({
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    link: siteUrl,
    selfUrl: `${siteUrl}/rss.xml`,
    articles,
  });

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
