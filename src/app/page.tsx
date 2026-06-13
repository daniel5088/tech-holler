import Link from "next/link";
import { ArrowRight, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { ArticleArt } from "@/components/article-art";
import { ArticleCard } from "@/components/article-card";
import { DemoBanner } from "@/components/demo-banner";
import { categories, getCategory } from "@/data/site";
import { getArticles } from "@/lib/content";
import { formatDateTime } from "@/lib/format";

export default async function Home() {
  const articles = await getArticles({ limit: 6 });
  const [lead, ...rest] = articles;

  if (!lead) {
    return <main className="shell page-section">No published stories yet.</main>;
  }

  const leadCategory = getCategory(lead.category);

  return (
    <main>
      {articles.some((article) => article.isDemo) && (
        <div className="shell">
          <DemoBanner />
        </div>
      )}

      <section className="hero shell">
        <div className="hero-kicker">
          <span className="pulse-dot" />
          THE BIG HOLLER
        </div>
        <div className="hero-grid">
          <div className="hero-copy">
            <div className="story-meta">
              {lead.editorialMode === "talk-around-town" && (
                <span className="talk-chip">Talk Around Town</span>
              )}
              <span style={{ color: leadCategory?.accent }}>{leadCategory?.name}</span>
              <span>Updated {formatDateTime(lead.updatedAt)}</span>
            </div>
            <h1>{lead.title}</h1>
            <p>{lead.dek}</p>
            <Link href={`/article/${lead.slug}`} className="primary-button">
              Get the whole story <ArrowRight size={17} />
            </Link>
            <div className="hero-facts">
              <div>
                <strong>{lead.confidence}</strong>
                <span>
                  {lead.editorialMode === "talk-around-town"
                    ? "source confidence"
                    : "confidence"}
                </span>
              </div>
              <div>
                <strong>{lead.sources.length}</strong>
                <span>cited sources</span>
              </div>
              <div>
                <strong>{lead.trendScore}</strong>
                <span>trend score</span>
              </div>
            </div>
          </div>
          <Link href={`/article/${lead.slug}`} className="hero-art">
            <ArticleArt
              slug={lead.slug}
              title={lead.heroImageAlt}
              category={lead.category}
              imageUrl={lead.heroImageUrl}
              priority
            />
            <span className="image-credit">Editorial illustration</span>
          </Link>
        </div>
      </section>

      <section className="signal-band">
        <div className="shell signal-grid">
          <div>
            <Radar aria-hidden="true" />
            <span>
              <strong>30-minute watch</strong>
              Trend spikes across multiple public channels
            </span>
          </div>
          <div>
            <ShieldCheck aria-hidden="true" />
            <span>
              <strong>Clear source labels</strong>
              Verified reporting and town talk never wear the same hat
            </span>
          </div>
          <div>
            <Sparkles aria-hidden="true" />
            <span>
              <strong>Original synthesis</strong>
              Fresh reporting with receipts, never copied articles
            </span>
          </div>
        </div>
      </section>

      <section className="shell page-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FRESH OFF THE WIRE</span>
            <h2>Latest hollers</h2>
          </div>
          <Link href="/latest">
            See every story <ArrowRight size={15} />
          </Link>
        </div>
        <div className="story-grid">
          {rest.slice(0, 3).map((article) => (
            <ArticleCard article={article} key={article.id} />
          ))}
        </div>
      </section>

      <section className="shell page-section category-overview">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PICK YOUR PATCH</span>
            <h2>Explore the future</h2>
          </div>
        </div>
        <div className="category-grid">
          {categories.map((category, index) => (
            <Link href={`/category/${category.slug}`} key={category.slug}>
              <span className="category-number">0{index + 1}</span>
              <span className="category-dot" style={{ background: category.accent }} />
              <h3>{category.name}</h3>
              <p>{category.description}</p>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </section>

      <section className="dark-section">
        <div className="shell future-grid">
          <div>
            <span className="eyebrow">FUTURECAST DESK</span>
            <h2>We don&apos;t predict the future. We show our homework.</h2>
            <p>
              Every forecast carries a time horizon, assumptions, evidence, and a confidence
              label. Speculation stays clearly marked so nobody mistakes a hunch for a fact.
            </p>
            <Link href="/category/futurecasting" className="outline-button">
              Browse futurecasts <ArrowRight size={16} />
            </Link>
          </div>
          {rest.slice(3, 5).map((article) => (
            <ArticleCard article={article} variant="compact" key={article.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
