import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Rss } from "lucide-react";
import { ArticleCard } from "@/components/article-card";
import { getCategory } from "@/data/site";
import { getArticles } from "@/lib/content";
import type { CategorySlug } from "@/types/content";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const category = getCategory((await params).slug);
  return category
    ? {
        title: category.name,
        description: category.description,
        alternates: {
          types: {
            "application/rss+xml": [
              {
                url: `/category/${category.slug}/rss.xml`,
                title: `${category.name} RSS`,
              },
            ],
          },
        },
      }
    : { title: "Category not found" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const articles = await getArticles({ category: slug as CategorySlug });

  return (
    <main className="shell page-section listing-page">
      <header className="page-header category-header">
        <span className="category-rule" style={{ background: category.accent }} />
        <span className="eyebrow">THE {category.shortName.toUpperCase()} DESK</span>
        <h1>{category.name}</h1>
        <p>{category.description}</p>
        <a
          className="category-feed-link"
          href={`/category/${category.slug}/rss.xml`}
          style={{ "--feed-accent": category.accent } as React.CSSProperties}
        >
          <Rss size={15} aria-hidden="true" />
          Subscribe to the {category.shortName} feed
        </a>
      </header>
      {articles.length ? (
        <div className="listing-grid">
          {articles.map((article) => (
            <ArticleCard article={article} key={article.id} />
          ))}
        </div>
      ) : (
        <div className="empty-state">No stories in this patch yet. The monitor is still running.</div>
      )}
    </main>
  );
}
