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

export function hostnameFor(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
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
  const domains = new Set(factualSources.map((source) => sourceIdentity(source.url)));
  const hasAuthoritativeSource = factualSources.some(
    (source) =>
      source.sourceType === "primary" || source.sourceType === "top-tier",
  );

  return {
    passes: domains.size >= 1 && hasAuthoritativeSource,
    independentDomains: domains.size,
    hasAuthoritativeSource,
  };
}
