import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import { ArticleArt } from "@/components/article-art";
import { getCategory, SITE_NAME } from "@/data/site";
import { getArticleBySlug } from "@/lib/content";
import { publicUrl, siteUrl } from "@/lib/env";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const article = await getArticleBySlug((await params).slug);
  if (!article) return { title: "Story not found" };

  return {
    title: article.title,
    description: article.dek,
    alternates: { canonical: `/article/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.dek,
      type: "article",
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      // og:image is supplied by the generated opengraph-image route; omit the key
      // entirely so it isn't suppressed (setting images: undefined would).
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const article = await getArticleBySlug((await params).slug);
  if (!article) notFound();

  const category = getCategory(article.category);
  const isTalkAroundTown = article.editorialMode === "talk-around-town";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": isTalkAroundTown ? "Article" : "NewsArticle",
    headline: article.title,
    description: article.dek,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    author: { "@type": "Person", name: article.author },
    publisher: { "@type": "Organization", name: SITE_NAME },
    mainEntityOfPage: `${siteUrl}/article/${article.slug}`,
    image: article.heroImageUrl,
  };

  return (
    <main className="article-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {article.isDemo && (
        <div className="demo-story-note">
          Demonstration story: this sample shows the article template and is not current reporting.
        </div>
      )}
      {isTalkAroundTown && (
        <div className="talk-story-note">
          <strong>Talk Around Town</strong>
          <span>
            This is attributed chatter and analysis, not fully verified reporting.{" "}
            {article.uncertaintyNote}
          </span>
        </div>
      )}
      <header className="article-header shell">
        <div className="story-meta">
          {article.isBreaking && <span className="breaking-chip">Breaking</span>}
          {isTalkAroundTown && <span className="talk-chip">Talk Around Town</span>}
          <Link href={`/category/${article.category}`} style={{ color: category?.accent }}>
            {category?.name}
          </Link>
          {article.forecastHorizon && <span>Horizon: {article.forecastHorizon}</span>}
        </div>
        <h1>{article.title}</h1>
        <p className="article-dek">{article.dek}</p>
        <div className="byline">
          <span className="author-avatar">BB</span>
          <div>
            <strong>By {article.author}</strong>
            <span>
              Published {formatDateTime(article.publishedAt)} · {article.readingMinutes} min read
            </span>
          </div>
        </div>
      </header>

      <div className="shell article-hero">
        <ArticleArt
          slug={article.slug}
          title={article.heroImageAlt}
          category={article.category}
          imageUrl={article.heroImageUrl}
          priority
        />
      </div>

      <div className="shell article-layout">
        <aside className="article-sidebar">
          <div className="confidence-card">
            <span>REPORTING CONFIDENCE</span>
            <strong>{article.confidence}</strong>
            <div className={`confidence-meter ${article.confidence}`}>
              <i />
            </div>
            <small>
              {isTalkAroundTown
                ? "Low means the chatter is not independently confirmed"
                : "Based on source quality and agreement"}
            </small>
          </div>
          <div className="article-stat">
            <Clock size={17} />
            <span>
              <strong>{article.readingMinutes} minutes</strong>
              Reading time
            </span>
          </div>
          <div className="article-stat">
            <ShieldCheck size={17} />
            <span>
              <strong>{article.sources.length} sources</strong>
              Linked below
            </span>
          </div>
        </aside>

        <article className="article-body">
          <section className="quick-take">
            <span>THE QUICK TAKE</span>
            <ul>
              {article.quickTake.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          {article.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}

          <section className="sources-section">
            <h2>{isTalkAroundTown ? "Who is doing the hollering" : "Receipts on the tailgate"}</h2>
            <p>
              {isTalkAroundTown
                ? "These links show where the chatter came from. A link is attribution, not our endorsement or independent confirmation."
                : "Social posts can point us toward a story, but they do not establish facts. These are the sources used for the published claims."}
            </p>
            <ol>
              {article.sources.map((source) => (
                <li key={`${source.url}-${source.title}`}>
                  <a
                    href={publicUrl(source.url)}
                    target={source.url.startsWith("/") ? undefined : "_blank"}
                    rel={source.url.startsWith("/") ? undefined : "noopener noreferrer"}
                  >
                    <span>{source.title}</span>
                    <small>
                      {source.publisher} · {source.sourceType.replace("-", " ")}
                    </small>
                    <ExternalLink size={14} />
                  </a>
                </li>
              ))}
            </ol>
          </section>

          <section className="revision-card">
            <RefreshCw size={18} />
            <div>
              <strong>Revision record</strong>
              <p>
                Last checked {formatDateTime(article.updatedAt)}.{" "}
                {article.revisionNote ?? "No corrections or material updates recorded."}
              </p>
            </div>
          </section>
        </article>
      </div>
    </main>
  );
}
