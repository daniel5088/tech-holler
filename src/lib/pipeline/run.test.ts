import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrendCluster } from "@/types/content";

const mocks = vi.hoisted(() => ({
  collectTrendSignals: vi.fn(),
  clusterTrends: vi.fn(),
  selectPublishingCandidates: vi.fn(),
  persistTrendSweep: vi.fn(),
  produceArticle: vi.fn(),
  recordJob: vi.fn(),
}));

vi.mock("@/lib/pipeline/adapters", () => ({
  collectTrendSignals: mocks.collectTrendSignals,
}));
vi.mock("@/lib/pipeline/trend-scoring", () => ({
  clusterTrends: mocks.clusterTrends,
  selectPublishingCandidates: mocks.selectPublishingCandidates,
}));
vi.mock("@/lib/pipeline/repository", () => ({
  persistTrendSweep: mocks.persistTrendSweep,
  recordJob: mocks.recordJob,
}));
vi.mock("@/lib/pipeline/publisher", () => ({
  produceArticle: mocks.produceArticle,
}));

import { runPublishingJob } from "@/lib/pipeline/run";

const cluster = (key: string): TrendCluster => ({
  key,
  label: key,
  items: [],
  score: 80,
  channels: 2,
  factualSignals: 2,
  hasGoogleNews: true,
  selectionScore: 110,
  qualifiedForBreaking: true,
});

describe("publishing job candidate attempts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collectTrendSignals.mockResolvedValue({ items: [], errors: [] });
    const clusters = [cluster("one"), cluster("two"), cluster("three")];
    mocks.clusterTrends.mockReturnValue(clusters);
    mocks.selectPublishingCandidates.mockReturnValue(clusters);
  });

  it("tries another candidate after a block and stops after reaching the target", async () => {
    mocks.produceArticle
      .mockResolvedValueOnce({ status: "blocked", reason: "Uncertain claims" })
      .mockResolvedValueOnce({ status: "published", article: { slug: "published" } });

    const result = await runPublishingJob({ type: "daily", count: 1 });

    expect(mocks.produceArticle).toHaveBeenCalledTimes(2);
    expect(result.results.map(({ status }) => status)).toEqual(["blocked", "published"]);
    expect(mocks.recordJob).toHaveBeenCalledWith(
      "daily",
      "completed",
      expect.objectContaining({ attemptedCandidates: 2, publicationTarget: 1 }),
    );
  });

  it("blocks the job after three unsuccessful candidates", async () => {
    mocks.produceArticle.mockResolvedValue({ status: "blocked", reason: "Gate failed" });

    await runPublishingJob({ type: "daily", count: 1 });

    expect(mocks.produceArticle).toHaveBeenCalledTimes(3);
    expect(mocks.recordJob).toHaveBeenCalledWith(
      "daily",
      "blocked",
      expect.objectContaining({ attemptedCandidates: 3, publicationTarget: 1 }),
    );
  });
});
