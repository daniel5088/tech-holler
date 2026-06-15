import { describe, expect, it } from "vitest";
import {
  classifyTrendCategory,
  clusterTrends,
  editorialNewsworthiness,
  normalizeTopic,
  scoreTrendItem,
  selectCategoryCandidates,
  selectPublishingCandidates,
} from "./trend-scoring";
import type { TrendCluster, TrendItem } from "@/types/content";

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

const candidateCluster: TrendCluster = {
  key: "candidate",
  label: "Candidate technology story",
  items: [item({ channel: "google-news" })],
  score: 80,
  channels: 2,
  factualSignals: 2,
  hasGoogleNews: true,
  selectionScore: 100,
  qualifiedForBreaking: true,
};

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

  it("surfaces a single trusted-source story even without an explicit development verb", () => {
    const candidates = selectPublishingCandidates(
      clusterTrends([
        item({
          channel: "google-news",
          title:
            "Bridging three-dimensional molecular structures and artificial intelligence with a conformation description language - Nature",
        }),
      ]),
      "daily",
    );

    expect(candidates).toHaveLength(1);
  });

  it.each([
    ["OpenAI releases new reasoning model for autonomous robots", "ai-robotics"],
    ["Nvidia unveils next-generation laptop GPU and processor", "computing-gadgets"],
    ["CISA confirms cloud authentication breach investigation", "cyber-internet"],
    ["NASA delays Artemis lunar mission after heat shield review", "space-science"],
    ["Star Trek communicator inspires working universal translator prototype", "sci-fi-reality"],
    ["Analysts forecast quantum networks could expand by 2030", "futurecasting"],
  ])("classifies %s as %s", (title, category) => {
    expect(
      classifyTrendCategory({
        ...candidateCluster,
        label: title,
        items: [item({ channel: "google-news", title })],
      }),
    ).toBe(category);
  });

  it("rejects an ambiguous candidate instead of assigning a fallback category", () => {
    expect(
      classifyTrendCategory({
        ...candidateCluster,
        label: "Technology companies announce several new products",
        items: [
          item({
            channel: "google-news",
            title: "Technology companies announce several new products",
          }),
        ],
      }),
    ).toBeNull();
  });

  it("filters ranked candidates to the requested category", () => {
    const selected = selectCategoryCandidates(
      [
        {
          ...candidateCluster,
          key: "space",
          label: "NASA launches lunar science mission",
          items: [item({ channel: "google-news", title: "NASA launches lunar science mission" })],
        },
        {
          ...candidateCluster,
          key: "cyber",
          label: "CISA confirms major software vulnerability",
          items: [item({ channel: "google-news", title: "CISA confirms major software vulnerability" })],
        },
      ],
      "space-science",
    );

    expect(selected.map(({ key }) => key)).toEqual(["space"]);
  });
});
