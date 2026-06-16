import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDraft, ResearchPacket } from "./schemas";
import type { TrendCluster } from "@/types/content";

const mocks = vi.hoisted(() => ({
  getArticleBySlug: vi.fn(),
  getArticles: vi.fn(),
  findDuplicate: vi.fn(),
  hasSuspiciousPhraseReuse: vi.fn(),
  moderateDraft: vi.fn(),
  researchTrend: vi.fn(),
  verifyDraft: vi.fn(),
  writeArticle: vi.fn(),
  persistArticle: vi.fn(),
  persistResearchPacket: vi.fn(),
  recentPublishedHeadlines: vi.fn(),
  updatePublishedArticle: vi.fn(),
  hasIndependentSources: vi.fn(),
}));

vi.mock("@/lib/content", () => ({
  getArticleBySlug: mocks.getArticleBySlug,
  getArticles: mocks.getArticles,
}));
vi.mock("@/lib/pipeline/deduplication", () => ({
  findDuplicate: mocks.findDuplicate,
  hasSuspiciousPhraseReuse: mocks.hasSuspiciousPhraseReuse,
}));
vi.mock("@/lib/pipeline/anthropic", () => ({
  moderateDraft: mocks.moderateDraft,
  researchTrend: mocks.researchTrend,
  verifyDraft: mocks.verifyDraft,
  writeArticle: mocks.writeArticle,
}));
vi.mock("@/lib/pipeline/repository", () => ({
  persistArticle: mocks.persistArticle,
  persistResearchPacket: mocks.persistResearchPacket,
  recentPublishedHeadlines: mocks.recentPublishedHeadlines,
  updatePublishedArticle: mocks.updatePublishedArticle,
}));
vi.mock("@/lib/pipeline/source-policy", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./source-policy")>()),
  hasIndependentSources: mocks.hasIndependentSources,
}));

import { produceArticle } from "./publisher";

const packet: ResearchPacket = {
  topic: "Specific event",
  thesis: "Two trusted sources confirm a specific event.",
  editorialMode: "reported",
  sourceAssessment: "A primary source and an independent report support the central event.",
  uncertaintyNote: "Some implementation details remain unknown, but the central event is supported.",
  category: "ai-robotics",
  isForecast: false,
  forecastHorizon: null,
  confidence: "high",
  claims: [
    {
      claim: "A company made an announcement.",
      evidenceUrls: ["https://openai.com/example"],
      agreement: "confirmed",
    },
    {
      claim: "Independent reporting confirmed it.",
      evidenceUrls: ["https://reuters.com/example"],
      agreement: "confirmed",
    },
    {
      claim: "The announcement applies in the United States.",
      evidenceUrls: ["https://openai.com/example", "https://reuters.com/example"],
      agreement: "confirmed",
    },
  ],
  sources: [
    {
      title: "Company statement",
      publisher: "OpenAI",
      url: "https://openai.com/example",
      publishedAt: "2026-06-13T00:00:00Z",
      sourceType: "primary",
    },
    {
      title: "Independent report",
      publisher: "Reuters",
      url: "https://reuters.com/example",
      publishedAt: "2026-06-13T00:00:00Z",
      sourceType: "top-tier",
    },
  ],
  disagreements: [],
  sourceSnippets: ["source wording that should not be copied"],
};

const draft: ArticleDraft = {
  slug: "specific-event",
  title: "A Specific Technology Event Has Reached the United States",
  dek: "Two independent sources describe a concrete technology development with immediate relevance.",
  editorialMode: "reported",
  uncertaintyNote: "Some implementation details remain unknown, but the central event is supported.",
  category: "ai-robotics",
  confidence: "high",
  forecastHorizon: null,
  heroImageAlt: "An editorial illustration of a technology announcement",
  heroImagePrompt: "An editorial illustration of a technology announcement in a newsroom",
  quickTake: [
    "A company announced a specific development.",
    "Independent reporting confirmed the announcement.",
    "The development applies in the United States.",
  ],
  sections: [
    { heading: "What happened", paragraphs: ["A".repeat(100)] },
    { heading: "What is confirmed", paragraphs: ["B".repeat(100)] },
    { heading: "What comes next", paragraphs: ["C".repeat(100)] },
  ],
  sources: packet.sources,
};

const cluster: TrendCluster = {
  key: "specific-event",
  label: "Specific event",
  items: [],
  score: 80,
  channels: 2,
  factualSignals: 2,
  hasGoogleNews: true,
  selectionScore: 110,
  qualifiedForBreaking: true,
};

describe("article draft repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.researchTrend.mockResolvedValue(packet);
    mocks.writeArticle.mockResolvedValue(draft);
    mocks.hasIndependentSources.mockReturnValue({
      passes: true,
      independentDomains: 2,
      hasAuthoritativeSource: true,
    });
    mocks.moderateDraft.mockResolvedValue(true);
    mocks.verifyDraft.mockResolvedValue({ passes: true, report: "PASS" });
    mocks.getArticles.mockResolvedValue([]);
    mocks.recentPublishedHeadlines.mockResolvedValue([]);
    mocks.findDuplicate.mockReturnValue(null);
  });

  it("rewrites once after suspicious phrase reuse", async () => {
    mocks.hasSuspiciousPhraseReuse
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const result = await produceArticle(cluster, false);

    expect(result.status).toBe("published");
    expect(mocks.writeArticle).toHaveBeenCalledTimes(2);
    expect(mocks.writeArticle.mock.calls[1][2]).toContain("reused source phrasing");
  });

  it("rewrites once using factual verification feedback", async () => {
    mocks.hasSuspiciousPhraseReuse.mockReturnValue(false);
    mocks.verifyDraft
      .mockResolvedValueOnce({ passes: false, report: "FAIL: A quick take is incomplete." })
      .mockResolvedValueOnce({ passes: true, report: "PASS" });

    const result = await produceArticle(cluster, false);

    expect(result.status).toBe("published");
    expect(mocks.writeArticle).toHaveBeenCalledTimes(2);
    expect(mocks.writeArticle.mock.calls[1][2]).toContain("quick take is incomplete");
  });

  it("publishes single-source uncertainty as Talk Around Town", async () => {
    const talkPacket: ResearchPacket = {
      ...packet,
      editorialMode: "talk-around-town",
      confidence: "low",
      sourceAssessment: "Only one community source discusses the claim, with no independent confirmation.",
      uncertaintyNote: "The central claim is unverified and could be incomplete, mistaken, or promotional.",
      claims: [
        {
          claim: "A community post claims a prototype is being tested.",
          evidenceUrls: ["https://community.example/prototype"],
          agreement: "uncertain",
        },
        {
          claim: "The post provides no independent test data.",
          evidenceUrls: ["https://community.example/prototype"],
          agreement: "confirmed",
        },
      ],
      sources: [{
        title: "Prototype discussion",
        publisher: "Community forum",
        url: "https://community.example/prototype",
        publishedAt: "2026-06-13T00:00:00Z",
        sourceType: "social-signal",
      }],
      sourceSnippets: [
        "A prototype may be undergoing limited testing, according to a post shared by one community member yesterday.",
      ],
    };
    const talkDraft: ArticleDraft = {
      ...draft,
      title: "Talk Around Town: Is a New Prototype Quietly Being Tested?",
      editorialMode: "talk-around-town",
      confidence: "low",
      uncertaintyNote: talkPacket.uncertaintyNote,
      sources: talkPacket.sources,
    };
    mocks.researchTrend.mockResolvedValue(talkPacket);
    mocks.writeArticle.mockResolvedValue(talkDraft);
    mocks.hasIndependentSources.mockReturnValue({
      passes: false,
      independentDomains: 0,
      hasAuthoritativeSource: false,
    });
    mocks.hasSuspiciousPhraseReuse.mockReturnValue(false);

    const result = await produceArticle(cluster, false);

    expect(result.status).toBe("published");
    expect(mocks.persistArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        editorialMode: "talk-around-town",
        confidence: "low",
        revisionNote: expect.stringContaining("Talk Around Town:"),
      }),
    );
  });
});
