import { describe, expect, it } from "vitest";
import { hasIndependentSources, isTrustedDomain } from "./source-policy";
import type { ArticleSource } from "@/types/content";

const source = (url: string, sourceType: ArticleSource["sourceType"]): ArticleSource => ({
  title: "Source title",
  publisher: new URL(url).hostname,
  url,
  publishedAt: new Date().toISOString(),
  sourceType,
});

describe("source policy", () => {
  it("recognizes trusted domains and their subdomains", () => {
    expect(isTrustedDomain("https://www.reuters.com/technology/story")).toBe(true);
    expect(isTrustedDomain("https://random-blog.example/story")).toBe(false);
  });

  it("passes two independent domains with an authoritative source", () => {
    const result = hasIndependentSources([
      source("https://reuters.com/a", "top-tier"),
      source("https://nasa.gov/b", "primary"),
    ]);
    expect(result.passes).toBe(true);
  });

  it("rejects two links from the same publisher", () => {
    const result = hasIndependentSources([
      source("https://reuters.com/a", "top-tier"),
      source("https://www.reuters.com/b", "top-tier"),
    ]);
    expect(result.passes).toBe(false);
  });

  it("treats different subdomains from one publisher as one source", () => {
    const result = hasIndependentSources([
      source("https://science.nasa.gov/a", "primary"),
      source("https://earthdata.nasa.gov/b", "primary"),
    ]);
    expect(result.passes).toBe(false);
  });

  it("ignores social signals for factual confirmation", () => {
    const result = hasIndependentSources([
      source("https://reuters.com/a", "top-tier"),
      source("https://nasa.gov/b", "social-signal"),
    ]);
    expect(result.passes).toBe(false);
  });
});
