import type { ArticleSource } from "@/types/content";

export const DEFAULT_TRUSTED_DOMAINS = [
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "npr.org",
  "theguardian.com",
  "washingtonpost.com",
  "nytimes.com",
  "ft.com",
  "cnbc.com",
  "bloomberg.com",
  "arstechnica.com",
  "theverge.com",
  "wired.com",
  "techcrunch.com",
  "nature.com",
  "science.org",
  "scientificamerican.com",
  "technologyreview.com",
  "ieee.org",
  "acm.org",
  "nasa.gov",
  "nist.gov",
  "cisa.gov",
  "ftc.gov",
  "sec.gov",
  "fda.gov",
  "energy.gov",
  "commerce.gov",
  "justice.gov",
  "treasury.gov",
  "federalreserve.gov",
  "fdic.gov",
  "occ.treas.gov",
  "noaa.gov",
  "whitehouse.gov",
  "congress.gov",
  "openai.com",
  "anthropic.com",
  "deepmind.google",
  "ai.google",
  "blog.google",
  "microsoft.com",
  "apple.com",
  "meta.com",
  "nvidia.com",
  "ibm.com",
  "intel.com",
  "amd.com",
  "spacex.com",
  "arxiv.org",
];

// Newswire distributors and vendor-owned domains carry a company's own announcement. They
// are authoritative for *what the company says* but are not independent corroboration, so
// they must not, on their own, qualify a topic for "reported" mode. (They remain trusted
// for evidence-URL validation; this only governs the independence requirement.)
export const NEWSWIRE_DOMAINS = [
  "prnewswire.com",
  "businesswire.com",
  "globenewswire.com",
  "prweb.com",
  "einnews.com",
  "einpresswire.com",
  "accesswire.com",
  "newswire.com",
  "prleap.com",
  "issuewire.com",
  "marketwire.com",
];

// Vendor domains that already appear in DEFAULT_TRUSTED_DOMAINS but are frequently the
// *subject* of the announcement (a company reporting on itself). Self-reporting from these
// is not independent corroboration.
export const VENDOR_SELF_DOMAINS = [
  "openai.com",
  "anthropic.com",
  "deepmind.google",
  "ai.google",
  "blog.google",
  "microsoft.com",
  "apple.com",
  "meta.com",
  "nvidia.com",
  "ibm.com",
  "intel.com",
  "amd.com",
  "spacex.com",
];

export const SELF_PROMOTIONAL_DOMAINS = [...VENDOR_SELF_DOMAINS, ...NEWSWIRE_DOMAINS];

export function hostnameFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isSelfPromotionalSource(url: string, domains = SELF_PROMOTIONAL_DOMAINS) {
  const hostname = hostnameFor(url);
  return domains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

export function isTrustedDomain(url: string, allowlist = DEFAULT_TRUSTED_DOMAINS) {
  const hostname = hostnameFor(url);
  return allowlist.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );
}

export function sourceIdentity(url: string, allowlist = DEFAULT_TRUSTED_DOMAINS) {
  const hostname = hostnameFor(url);
  return (
    allowlist.find(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    ) ?? hostname
  );
}

export function hasIndependentSources(sources: ArticleSource[]) {
  const factualSources = sources.filter(
    (source) =>
      source.sourceType !== "social-signal" && isTrustedDomain(source.url),
  );
  // Self-reporting (vendor-owned domains, newswire releases) is authoritative for what a
  // company claims but is not independent corroboration, so it cannot, by itself, satisfy
  // the "reported" source gate. A packet resting only on self-reporting falls through to
  // Talk Around Town, where the claim is published with explicit attribution instead.
  const independentSources = factualSources.filter(
    (source) => !isSelfPromotionalSource(source.url),
  );
  const independentDomains = new Set(
    independentSources.map((source) => sourceIdentity(source.url)),
  );
  const hasAuthoritativeSource = independentSources.some(
    (source) =>
      source.sourceType === "primary" || source.sourceType === "top-tier",
  );

  return {
    passes: independentDomains.size >= 1 && hasAuthoritativeSource,
    independentDomains: independentDomains.size,
    hasAuthoritativeSource,
    selfPromotionalOnly: factualSources.length > 0 && independentSources.length === 0,
  };
}
