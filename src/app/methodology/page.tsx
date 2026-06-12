import type { Metadata } from "next";
import { BookOpenCheck, CircleAlert, Scale, ScanSearch } from "lucide-react";

export const metadata: Metadata = {
  title: "Methodology and corrections",
  description: "How The Tech Holler detects trends, verifies facts, writes stories, and corrects errors.",
};

const principles = [
  {
    icon: ScanSearch,
    title: "Signals ain't facts",
    body: "Google Trends, social networks, forums, and aggregators tell us what people are noticing. They never count as confirmation by themselves.",
  },
  {
    icon: BookOpenCheck,
    title: "Two independent receipts",
    body: "Breaking coverage requires two independent trustworthy sources, including at least one primary source or top-tier newsroom.",
  },
  {
    icon: Scale,
    title: "Original synthesis",
    body: "The system builds a claim-by-claim research packet, writes an original article, links its sources, and checks for copied phrasing and duplicate coverage.",
  },
  {
    icon: CircleAlert,
    title: "Corrections stay visible",
    body: "Material updates create a revision entry. Corrections are labeled on the article instead of quietly disappearing down a digital creek.",
  },
];

export default function MethodologyPage() {
  return (
    <main className="shell page-section methodology-page">
      <header className="page-header">
        <span className="eyebrow">HOW THE SAUSAGE GETS MADE</span>
        <h1>Methodology & corrections</h1>
        <p>
          The voice may be rowdy. The evidence rules are not. Here is how automated stories earn
          their way onto the site.
        </p>
      </header>
      <div className="principle-grid">
        {principles.map(({ icon: Icon, title, body }) => (
          <section key={title}>
            <Icon aria-hidden="true" />
            <h2>{title}</h2>
            <p>{body}</p>
          </section>
        ))}
      </div>
      <div className="policy-copy">
        <section>
          <h2>Breaking-story gate</h2>
          <p>
            A topic must spike across at least two independent trend channels. The factual claims
            must then be confirmed by two independent trusted sources, one of which is primary or
            top-tier. Conflicting evidence, missing citations, or a near-duplicate story blocks
            publication.
          </p>
        </section>
        <section>
          <h2>Forecasts and science fiction</h2>
          <p>
            Forecasts are labeled with a horizon, assumptions, and confidence. Science-fiction
            coverage discusses culture and its relationship to real technology; fictional claims
            are never presented as current events.
          </p>
        </section>
        <section>
          <h2>The Alabama voice</h2>
          <p>
            Stories use a deliberately exaggerated, family-near-friendly Alabama narrator with
            occasional mild profanity. Names, quotations, technical terms, and numerical facts
            remain standard and exact. Slurs, harassment, and demeaning stereotypes are prohibited.
          </p>
        </section>
        <section>
          <h2>Report a correction</h2>
          <p>
            Production deployments should set a public editorial contact address and monitor it
            alongside automated source-health alerts. Every accepted correction creates a dated
            revision record.
          </p>
        </section>
      </div>
    </main>
  );
}
