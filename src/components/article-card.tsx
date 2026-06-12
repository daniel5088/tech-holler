import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getCategory } from "@/data/site";
import { formatDate } from "@/lib/format";
import type { Article } from "@/types/content";
import { ArticleArt } from "@/components/article-art";

export function ArticleCard({
  article,
  variant = "standard",
}: {
  article: Article;
  variant?: "standard" | "compact" | "feature";
}) {
  const category = getCategory(article.category);

  return (
    <article className={`article-card ${variant}`}>
      {variant !== "compact" && (
        <Link href={`/article/${article.slug}`} tabIndex={-1}>
          <ArticleArt
            slug={article.slug}
            title={article.heroImageAlt}
            category={article.category}
            imageUrl={article.heroImageUrl}
          />
        </Link>
      )}
      <div className="card-copy">
        <div className="story-meta">
          {article.isBreaking && <span className="breaking-chip">Breaking</span>}
          <span style={{ color: category?.accent }}>{category?.name}</span>
          <span>{formatDate(article.publishedAt)}</span>
          <span>{article.readingMinutes} min</span>
        </div>
        <h2>
          <Link href={`/article/${article.slug}`}>{article.title}</Link>
        </h2>
        {variant !== "compact" && <p>{article.dek}</p>}
        <Link href={`/article/${article.slug}`} className="read-link">
          Read the story <ArrowUpRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
