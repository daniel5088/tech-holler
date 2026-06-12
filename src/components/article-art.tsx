import type { CategorySlug } from "@/types/content";

export function ArticleArt({
  slug,
  title,
  category,
  imageUrl,
  priority = false,
}: {
  slug: string;
  title: string;
  category: CategorySlug;
  imageUrl?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`article-art art-${category}`}
      style={imageUrl ? { backgroundImage: `url("${imageUrl}")` } : undefined}
      role="img"
      aria-label={title}
      data-priority={priority ? "true" : undefined}
    >
      {!imageUrl && (
        <>
          <div className="art-grid" />
          <div className="art-orb" />
          <div className="art-lines" />
          <span className="art-code">{slug.slice(0, 3).toUpperCase()}</span>
        </>
      )}
    </div>
  );
}
