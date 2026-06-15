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
    expect(isTrustedDomain("https://www.federalreserve.gov/newsevents/example.htm")).toBe(true);
    expect(isTrustedDomain("https://www.washingtonpost.com/technology/example/")).toBe(true);
    expect(isTrustedDomain("https://random-blog.example/story")).toBe(false);
  });

  it("passes a single authoritative trusted source", () => {
    const result = hasIndependentSources([
      source("https://reuters.com/a", "top-tier"),
    ]);
    expect(result.passes).toBe(true);
  });

  it("passes two independent domains with an authoritative source", () => {
    const result = hasIndependentSources([
      source("https://reuters.com/a", "top-tier"),
      source("https://nasa.gov/b", "primary"),
    ]);
    expect(result.passes).toBe(true);
  });

  it("still requires an authoritative source rather than a specialist alone", () => {
    const result = hasIndependentSources([
      source("https://arxiv.org/abs/1234", "specialist"),
    ]);
    expect(result.passes).toBe(false);
  });

  it("ignores social signals when no factual source remains", () => {
    const result = hasIndependentSources([
      source("https://reuters.com/a", "social-signal"),
    ]);
    expect(result.passes).toBe(false);
  });

  it("rejects untrusted domains for factual confirmation", () => {
    const result = hasIndependentSources([
      source("https://random-blog.example/a", "top-tier"),
    ]);
    expect(result.passes).toBe(false);
  });
});
