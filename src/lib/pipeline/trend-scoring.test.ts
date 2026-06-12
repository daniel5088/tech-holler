import { describe, expect, it } from "vitest";
import { clusterTrends, normalizeTopic, scoreTrendItem } from "./trend-scoring";
import type { TrendItem } from "@/types/content";

function item(overrides: Partial<TrendItem>): TrendItem {
  return {
    id: "1",
    title: "New AI robot launches",
    url: "https://example.com/story",
    channel: "google-trends",
    capturedAt: new Date().toISOString(),
    engagement: 80,
    velocity: 90,
    credibility: 60,
    relevance: 90,
    ...overrides,
  };
}

describe("trend scoring", () => {
  it("normalizes equivalent topic words", () => {
    expect(normalizeTopic("The New AI Robot Launches!")).toBe("launches-new-robot");
  });

  it("keeps a score within zero and one hundred", () => {
    expect(scoreTrendItem(item({}))).toBeGreaterThan(0);
    expect(scoreTrendItem(item({ velocity: 500 }))).toBeLessThanOrEqual(100);
  });

  it("requires two channels and a high score for breaking qualification", () => {
    const clusters = clusterTrends([
      item({ id: "1", channel: "google-trends" }),
      item({ id: "2", channel: "hacker-news", title: "AI robot new launches" }),
    ]);
    expect(clusters[0].channels).toBe(2);
    expect(clusters[0].qualifiedForBreaking).toBe(true);
  });

  it("does not qualify a one-channel spike", () => {
    const [cluster] = clusterTrends([item({})]);
    expect(cluster.qualifiedForBreaking).toBe(false);
  });
});
