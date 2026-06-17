import type { Metadata } from "next";
import Link from "next/link";
import { NewsletterSignup } from "@/components/newsletter-signup";
import { SITE_NAME } from "@/data/site";

export const metadata: Metadata = {
  title: "About & accountability",
  description:
    "Who runs The Tech Holler, how the automated AI pipeline works, and how to reach us about corrections.",
  alternates: { canonical: "/about" },
};

const EDITORIAL_EMAIL = "techhollerdan@gmail.com";

export default function AboutPage() {
  return (
    <main className="shell page-section">
      <header className="page-header">
        <span className="eyebrow">WHO&apos;S BEHIND THE HOLLER</span>
        <h1>About &amp; accountability</h1>
        <p>
          {SITE_NAME} is an independent technology publication that researches and writes its stories
          with an automated AI pipeline, in a deliberately rowdy Alabama voice — under fixed editorial
          rules and automated checks. Here is who is responsible for it and how to hold us to it.
        </p>
      </header>

      <div className="policy-copy">
        <section>
          <h2>What this is</h2>
          <p>
            Every article is produced by software: it gathers trend signals, researches sources,
            drafts the story, and runs it through verification, attribution, moderation, and
            duplicate checks before it can publish. We think automated coverage can be useful and
            honest — but only if it is transparent about being automated. So we say it plainly,
            on every page.
          </p>
        </section>

        <section>
          <h2>Who is accountable</h2>
          <p>
            The site is operated by an independent publisher who is responsible for the editorial
            rules, the safety gates, and every correction. &quot;Buckley Byte&quot; is the
            publication&apos;s AI byline and narrator — a persona, not a real journalist. The
            accountability for what publishes rests with the human operator, not the persona.
          </p>
        </section>

        <section>
          <h2>Reported vs. Talk Around Town</h2>
          <p>
            Stories carry one of two labels. <strong>Reported</strong> pieces rest on at least one
            trusted primary or top-tier source. <strong>Talk Around Town</strong> pieces are
            attributed chatter and analysis that is not yet independently verified — clearly labeled,
            with the source&apos;s limitations spelled out. A link is attribution, not proof. The full
            standards live on our{" "}
            <Link href="/methodology">methodology &amp; corrections</Link> page.
          </p>
        </section>

        <section>
          <h2>Corrections</h2>
          <p>
            If something is wrong, tell us and we will fix it. Accepted corrections create a dated
            revision record on the article rather than quietly disappearing. Reach the editorial desk
            at <a href={`mailto:${EDITORIAL_EMAIL}`}>{EDITORIAL_EMAIL}</a>.
          </p>
        </section>

        <section>
          <h2>Privacy &amp; advertising</h2>
          <p>
            How we handle data, cookies, and third-party advertising is covered in our{" "}
            <Link href="/privacy">privacy policy</Link>.
          </p>
        </section>
      </div>

      <div className="about-newsletter">
        <NewsletterSignup variant="page" />
      </div>
    </main>
  );
}
