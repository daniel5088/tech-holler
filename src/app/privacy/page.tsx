import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How The Tech Holler handles data, cookies, and third-party advertising, including Google AdSense.",
};

const externalLink = {
  target: "_blank",
  rel: "noopener noreferrer",
} as const;

export default function PrivacyPage() {
  return (
    <main className="shell page-section">
      <header className="page-header">
        <span className="eyebrow">THE FINE PRINT</span>
        <h1>Privacy policy</h1>
        <p>
          How The Tech Holler handles your data, cookies, and third-party advertising. Last updated
          June 17, 2026.
        </p>
      </header>
      <div className="policy-copy">
        <section>
          <h2>Who we are</h2>
          <p>
            The Tech Holler (&quot;we&quot;, &quot;us&quot;) publishes automated technology coverage
            at thetechholler.com. This policy explains what information is collected when you visit
            the site and how it is used.
          </p>
        </section>
        <section>
          <h2>Information we collect</h2>
          <p>
            You do not need an account or to submit personal information to read the site. Like most
            websites, our hosting infrastructure automatically records standard technical request
            data &mdash; such as IP address, browser and device type, referring pages, and
            timestamps &mdash; for security, reliability, and aggregate analytics. We do not sell
            this information.
          </p>
        </section>
        <section>
          <h2>Cookies</h2>
          <p>
            The site and its service providers may use cookies and similar technologies to operate
            the site, remember preferences, and measure usage. You can control or delete cookies
            through your browser settings; disabling them may affect some functionality.
          </p>
        </section>
        <section>
          <h2>Advertising and third-party cookies</h2>
          <p>
            We use Google AdSense to display advertising. Third-party vendors, including Google, use
            cookies to serve ads based on your prior visits to this and other websites. Google&apos;s
            use of advertising cookies enables it and its partners to serve ads to you based on your
            visit to this site and/or other sites on the internet.
          </p>
          <p>
            You can opt out of personalized advertising by visiting{" "}
            <a href="https://adssettings.google.com" {...externalLink}>
              Google Ads Settings
            </a>
            . You can also opt out of some third-party vendors&apos; use of cookies for personalized
            advertising at{" "}
            <a href="https://www.aboutads.info/choices" {...externalLink}>
              aboutads.info/choices
            </a>{" "}
            or{" "}
            <a href="https://www.youronlinechoices.eu" {...externalLink}>
              youronlinechoices.eu
            </a>
            . For details on how Google uses information from sites that use its services, see{" "}
            <a href="https://policies.google.com/technologies/partner-sites" {...externalLink}>
              Google&apos;s partner-sites policy
            </a>
            .
          </p>
        </section>
        <section>
          <h2>Analytics</h2>
          <p>
            We use Google Analytics to understand aggregate traffic patterns. Google Analytics uses
            cookies and similar identifiers to measure how visitors use the site and may process data
            such as your IP address. You can opt out of Google Analytics across all websites by
            installing the{" "}
            <a href="https://tools.google.com/dlpage/gaoptout" {...externalLink}>
              Google Analytics Opt-out Browser Add-on
            </a>
            .
          </p>
        </section>
        <section>
          <h2>Children&apos;s privacy</h2>
          <p>
            The site is intended for a general audience and is not directed to children under 13. We
            do not knowingly collect personal information from children under 13.
          </p>
        </section>
        <section>
          <h2>Your choices</h2>
          <p>
            Depending on where you live, you may have rights to access, correct, or delete personal
            data, or to opt out of certain processing. To make a request, contact us using the
            address below.
          </p>
        </section>
        <section>
          <h2>Changes to this policy</h2>
          <p>
            We may update this policy as the site evolves or as legal requirements change. Material
            changes will be reflected by the &quot;last updated&quot; date above.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            Questions about this policy can be sent to techhollerdan@gmail.com.
          </p>
        </section>
      </div>
    </main>
  );
}
