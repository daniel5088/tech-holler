import type { Metadata } from "next";
import { Search } from "lucide-react";
import { ArticleCard } from "@/components/article-card";
import { getArticles } from "@/lib/content";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const query = (await searchParams).q?.trim() ?? "";
  const articles = query ? await getArticles({ query }) : [];

  return (
    <main className="shell page-section search-page">
      <header className="page-header">
        <span className="eyebrow">FIND A STORY</span>
        <h1>Search the holler</h1>
      </header>
      <form className="search-form">
        <Search size={20} aria-hidden="true" />
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="AI agents, passkeys, moon bases..."
          aria-label="Search stories"
        />
        <button type="submit">Search</button>
      </form>
      {query && (
        <div className="search-results">
          <p>
            {articles.length} result{articles.length === 1 ? "" : "s"} for <strong>{query}</strong>
          </p>
          <div className="listing-grid">
            {articles.map((article) => (
              <ArticleCard article={article} key={article.id} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
