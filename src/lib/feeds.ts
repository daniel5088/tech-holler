import type { Article } from "@/types/content";
import { siteUrl } from "@/lib/env";
import { SITE_NAME } from "@/data/site";

/** Newest item Google News will index from a sitemap, and the max it accepts. */
export const NEWS_SITEMAP_MAX_AGE_MS = 2 * 24 * 60 * 60 * 1000;
export const NEWS_SITEMAP_MAX_URLS = 1000;

const PUBLICATION_LANGUAGE = "en";

export function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character]!);
}

export function articleUrl(slug: string) {
  return `${siteUrl}/article/${slug}`;
}

function rssItem(article: Article) {
  return `
    <item>
      <title>${escapeXml(article.title)}</title>
      <description>${escapeXml(article.dek)}</description>
      <link>${articleUrl(article.slug)}</link>
      <guid isPermaLink="true">${articleUrl(article.slug)}</guid>
      <pubDate>${new Date(article.publishedAt).toUTCString()}</pubDate>
      <category>${escapeXml(article.category)}</category>
      ${article.editorialMode === "talk-around-town"
        ? "<category>Talk Around Town</category>"
        : ""}
    </item>`;
}

/**
 * Build an RSS 2.0 feed. `selfUrl` is the canonical URL of the feed itself and
 * is advertised via `atom:link rel="self"` so readers and validators can
 * discover the feed's own address.
 */
export function buildRssFeed(options: {
  title: string;
  description: string;
  link: string;
  selfUrl: string;
  articles: Article[];
}) {
  const items = options.articles.map(rssItem).join("");
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(options.title)}</title>
    <description>${escapeXml(options.description)}</description>
    <link>${options.link}</link>
    <atom:link href="${options.selfUrl}" rel="self" type="application/rss+xml" />
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${items}
  </channel>
</rss>`;
}

/**
 * Articles eligible for a Google News sitemap: published within the last two
 * days, newest first, capped at Google's per-sitemap limit.
 */
export function newsEligibleArticles(articles: Article[], now = Date.now()) {
  return articles
    .filter((article) => {
      const published = new Date(article.publishedAt).getTime();
      return Number.isFinite(published) && now - published <= NEWS_SITEMAP_MAX_AGE_MS;
    })
    .sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    )
    .slice(0, NEWS_SITEMAP_MAX_URLS);
}

function newsEntry(article: Article) {
  const image = article.heroImageUrl
    ? `
      <image:image>
        <image:loc>${escapeXml(article.heroImageUrl)}</image:loc>
        <image:caption>${escapeXml(article.heroImageAlt)}</image:caption>
      </image:image>`
    : "";
  return `
  <url>
    <loc>${articleUrl(article.slug)}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(SITE_NAME)}</news:name>
        <news:language>${PUBLICATION_LANGUAGE}</news:language>
      </news:publication>
      <news:publication_date>${new Date(article.publishedAt).toISOString()}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>
    </news:news>${image}
  </url>`;
}

/** Build a Google News sitemap from already-eligible, ordered articles. */
export function buildNewsSitemap(articles: Article[]) {
  const entries = articles.map(newsEntry).join("");
  return `<?xml version="1.0" encoding="UTF-8" ?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
>${entries}
</urlset>`;
}
