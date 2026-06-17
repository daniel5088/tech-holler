import { describe, expect, it } from "vitest";
import {
  NEWS_SITEMAP_MAX_AGE_MS,
  NEWS_SITEMAP_MAX_URLS,
  buildNewsSitemap,
  buildRssFeed,
  escapeXml,
  newsEligibleArticles,
} from "./feeds";
import type { Article } from "@/types/content";

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: "id-1",
    slug: "a-story",
    title: "A Story",
    dek: "A short dek.",
    category: "ai-robotics",
    publishedAt: "2026-06-17T12:00:00-04:00",
    updatedAt: "2026-06-17T12:00:00-04:00",
    readingMinutes: 4,
    author: "Buckley Byte",
    confidence: "medium",
    isBreaking: false,
    trendScore: 50,
    heroImageAlt: "Alt text",
    quickTake: [],
    sections: [],
    sources: [],
    ...overrides,
  };
}

describe("escapeXml", () => {
  it("escapes the five XML metacharacters", () => {
    expect(escapeXml(`<a href="x" & 'y'>`)).toBe(
      "&lt;a href=&quot;x&quot; &amp; &apos;y&apos;&gt;",
    );
  });
});

describe("buildRssFeed", () => {
  const xml = buildRssFeed({
    title: "Feed Title & More",
    description: "Feed description",
    link: "http://localhost:3000",
    selfUrl: "http://localhost:3000/rss.xml",
    articles: [
      makeArticle({ title: "First <Story>", slug: "first" }),
      makeArticle({
        slug: "talk",
        editorialMode: "talk-around-town",
      }),
    ],
  });

  it("escapes channel metadata and advertises a self link", () => {
    expect(xml).toContain("<title>Feed Title &amp; More</title>");
    expect(xml).toContain(
      '<atom:link href="http://localhost:3000/rss.xml" rel="self" type="application/rss+xml" />',
    );
  });

  it("emits an escaped item per article with absolute links", () => {
    expect(xml).toContain("<title>First &lt;Story&gt;</title>");
    expect(xml).toContain(
      "<link>http://localhost:3000/article/first</link>",
    );
    expect(xml).toContain(
      '<guid isPermaLink="true">http://localhost:3000/article/first</guid>',
    );
  });

  it("tags talk-around-town items with an extra category", () => {
    expect(xml).toContain("<category>Talk Around Town</category>");
  });
});

describe("newsEligibleArticles", () => {
  const now = new Date("2026-06-17T12:00:00Z").getTime();

  it("keeps only articles published within the news window, newest first", () => {
    const fresh = makeArticle({
      slug: "fresh",
      publishedAt: new Date(now - 60 * 60 * 1000).toISOString(),
    });
    const older = makeArticle({
      slug: "older",
      publishedAt: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
    });
    const stale = makeArticle({
      slug: "stale",
      publishedAt: new Date(now - NEWS_SITEMAP_MAX_AGE_MS - 1000).toISOString(),
    });

    const result = newsEligibleArticles([older, stale, fresh], now);

    expect(result.map((article) => article.slug)).toEqual(["fresh", "older"]);
  });

  it("caps the result at Google's per-sitemap limit", () => {
    const many = Array.from({ length: NEWS_SITEMAP_MAX_URLS + 25 }, (_, index) =>
      makeArticle({
        slug: `story-${index}`,
        publishedAt: new Date(now - index * 1000).toISOString(),
      }),
    );

    expect(newsEligibleArticles(many, now)).toHaveLength(NEWS_SITEMAP_MAX_URLS);
  });
});

describe("buildNewsSitemap", () => {
  it("declares the news namespace and a news block per article", () => {
    const xml = buildNewsSitemap([
      makeArticle({ slug: "first", title: "First & Best" }),
    ]);

    expect(xml).toContain(
      'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"',
    );
    expect(xml).toContain("<loc>http://localhost:3000/article/first</loc>");
    expect(xml).toContain("<news:title>First &amp; Best</news:title>");
    expect(xml).toContain("<news:language>en</news:language>");
    expect(xml).toContain(
      "<news:publication_date>2026-06-17T16:00:00.000Z</news:publication_date>",
    );
  });

  it("includes a hero image block only when an image is present", () => {
    const withImage = buildNewsSitemap([
      makeArticle({ heroImageUrl: "http://localhost:3000/hero.jpg" }),
    ]);
    const withoutImage = buildNewsSitemap([makeArticle()]);

    expect(withImage).toContain(
      "<image:loc>http://localhost:3000/hero.jpg</image:loc>",
    );
    expect(withoutImage).not.toContain("<image:image>");
  });
});
