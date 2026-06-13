import type { ResearchPacket } from "@/lib/pipeline/schemas";
import { isTrustedDomain, sourceIdentity } from "@/lib/pipeline/source-policy";

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || key === "ref" || key === "source") {
        url.searchParams.delete(key);
      }
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

export function validateResearchPacket(packet: ResearchPacket) {
  const factualSources = packet.sources.filter(
    (source) => source.sourceType !== "social-signal" && isTrustedDomain(source.url),
  );
  const sourceUrls = new Map(
    factualSources.map((source) => [canonicalUrl(source.url), source]),
  );
  const unsupportedClaims = packet.claims.flatMap((claim) => {
    const unsupportedUrls = claim.evidenceUrls.filter(
      (url) => !sourceUrls.has(canonicalUrl(url)),
    );
    return unsupportedUrls.length ? [{ claim: claim.claim, unsupportedUrls }] : [];
  });
  const referencedSources = new Set(
    packet.claims.flatMap((claim) => claim.evidenceUrls.map(canonicalUrl)),
  );
  const unreferencedSources = factualSources
    .filter((source) => !referencedSources.has(canonicalUrl(source.url)))
    .map((source) => source.url);
  const evidenceDomains = new Set(
    packet.claims
      .flatMap((claim) => claim.evidenceUrls)
      .map((url) => sourceIdentity(url))
      .filter(Boolean),
  );

  return {
    passes:
      unsupportedClaims.length === 0 &&
      unreferencedSources.length === 0 &&
      evidenceDomains.size >= 2,
    unsupportedClaims,
    unreferencedSources,
    evidenceDomains: evidenceDomains.size,
  };
}

export function validateTalkAroundTownPacket(packet: ResearchPacket) {
  const sourceUrls = new Map(
    packet.sources.map((source) => [canonicalUrl(source.url), source]),
  );
  const unsupportedClaims = packet.claims.flatMap((claim) => {
    const unsupportedUrls = claim.evidenceUrls.filter(
      (url) => !sourceUrls.has(canonicalUrl(url)),
    );
    return unsupportedUrls.length ? [{ claim: claim.claim, unsupportedUrls }] : [];
  });
  const referencedSources = new Set(
    packet.claims.flatMap((claim) => claim.evidenceUrls.map(canonicalUrl)),
  );
  const unreferencedSources = packet.sources
    .filter((source) => !referencedSources.has(canonicalUrl(source.url)))
    .map((source) => source.url);
  const evidenceDomains = new Set(
    packet.claims
      .flatMap((claim) => claim.evidenceUrls)
      .map((url) => sourceIdentity(url, []))
      .filter(Boolean),
  );

  return {
    passes:
      unsupportedClaims.length === 0 &&
      unreferencedSources.length === 0 &&
      evidenceDomains.size >= 1 &&
      packet.sourceAssessment.trim().length >= 30 &&
      packet.uncertaintyNote.trim().length >= 30,
    unsupportedClaims,
    unreferencedSources,
    evidenceDomains: evidenceDomains.size,
  };
}
