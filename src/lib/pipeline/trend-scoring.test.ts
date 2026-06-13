import { describe, expect, it } from "vitest";
import {
  clusterTrends,
  editorialNewsworthiness,
  normalizeTopic,
  scoreTrendItem,
  selectPublishingCandidates,
} from "./trend-scoring";
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
      item({
        id: "1",
        channel: "google-news",
        title: "Acme launches a new warehouse robot in Alabama",
      }),
      item({
        id: "2",
        channel: "hacker-news",
        title: "New Acme warehouse robot launches in Alabama",
      }),
    ]);
    expect(clusters[0].channels).toBe(2);
    expect(clusters[0].qualifiedForBreaking).toBe(true);
  });

  it("does not qualify a one-channel spike", () => {
    const [cluster] = clusterTrends([item({})]);
    expect(cluster.qualifiedForBreaking).toBe(false);
  });

  it("merges substantially overlapping factual headlines", () => {
    const clusters = clusterTrends([
      item({
        id: "1",
        channel: "google-news",
        title: "Acme launches a new warehouse robot in Alabama",
      }),
      item({
        id: "2",
        channel: "hacker-news",
        title: "New Acme warehouse robot launches in Alabama",
      }),
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].factualSignals).toBe(2);
    expect(clusters[0].hasGoogleNews).toBe(true);
  });

  it("ranks specific Google News stories above broad social chatter", () => {
    const clusters = clusterTrends([
      item({
        id: "news",
        channel: "google-news",
        title: "NASA delays Artemis mission after heat shield review",
      }),
      item({
        id: "social",
        channel: "mastodon",
        title: "Artificial Intelligence",
        velocity: 100,
        engagement: 100,
      }),
    ]);

    const candidates = selectPublishingCandidates(clusters, "daily");
    expect(candidates).toHaveLength(1);
    expect(candidates[0].items[0].id).toBe("news");
  });

  it("does not treat a broad product term as a daily candidate", () => {
    const candidates = selectPublishingCandidates(
      clusterTrends([
        item({
          id: "broad",
          channel: "google-trends",
          title: "GPT model",
          velocity: 100,
          engagement: 100,
        }),
      ]),
      "daily",
    );

    expect(candidates).toHaveLength(0);
  });

  it("prefers a concrete trusted report over evergreen and promotional items", () => {
    expect(
      editorialNewsworthiness(
        "Exclusive: U.S. bank regulators ramp up scrutiny of AI use - Reuters",
      ),
    ).toBeGreaterThan(
      editorialNewsworthiness(
        "DOE Explains Artificial Intelligence - Department of Energy (.gov)",
      ),
    );
    expect(
      editorialNewsworthiness(
        "Meet the 2 Newcomers Challenging the Cloud Computing Titans in AI - Yahoo Finance",
      ),
    ).toBeLessThan(0);
  });
});
