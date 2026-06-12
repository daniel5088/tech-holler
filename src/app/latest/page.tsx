import type { Metadata } from "next";
import { ArticleCard } from "@/components/article-card";
import { getArticles } from "@/lib/content";

export const metadata: Metadata = {
  title: "Latest technology news",
  description: "The newest technology reporting and future forecasts from The Tech Holler.",
};

export default async function LatestPage() {
  const articles = await getArticles();

  return (
    <main className="shell page-section listing-page">
      <header className="page-header">
        <span className="eyebrow">EVERY STORY, NEWEST FIRST</span>
        <h1>Latest hollers</h1>
        <p>Technology news, science-fiction signals, and forecasts with the receipts attached.</p>
      </header>
      <div className="listing-grid">
        {articles.map((article) => (
          <ArticleCard article={article} key={article.id} />
        ))}
      </div>
    </main>
  );
}
