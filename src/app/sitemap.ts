import type { MetadataRoute } from "next";
import { categories } from "@/data/site";
import { getArticles } from "@/lib/content";
import { siteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await getArticles();
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/latest`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/search`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/methodology`, changeFrequency: "monthly", priority: 0.5 },
    ...categories.map((category) => ({
      url: `${siteUrl}/category/${category.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    ...articles.map((article) => ({
      url: `${siteUrl}/article/${article.slug}`,
      lastModified: article.updatedAt,
      changeFrequency: "weekly" as const,
      priority: article.isBreaking ? 0.9 : 0.7,
    })),
  ];
}
