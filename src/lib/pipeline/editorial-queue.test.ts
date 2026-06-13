import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDraft, ResearchPacket } from "./schemas";
import type { TrendCluster } from "@/types/content";

const mocks = vi.hoisted(() => ({
  collectTrendSignals: vi.fn(),
  clusterTrends: vi.fn(),
  selectPublishingCandidates: vi.fn(),
  researchTrend: vi.fn(),
  writeArticle: vi.fn(),
  verifyDraft: vi.fn(),
  moderateDraft: vi.fn(),
  persistEditorialDraft: vi.fn(),
  persistResearchPacket: vi.fn(),
  recentPublishedHeadlines: vi.fn(),
  recordJob: vi.fn(),
  getArticles: vi.fn(),
  findDuplicate: vi.fn(),
  hasSuspiciousPhraseReuse: vi.fn(),
  hasIndependentSources: vi.fn(),
  validateResearchPacket: vi.fn(),
  validateTalkAroundTownPacket: vi.fn(),
}));

vi.mock("@/lib/pipeline/adapters", () => ({
  collectTrendSignals: mocks.collectTrendSignals,
}));
vi.mock("@/lib/pipeline/trend-scoring", () => ({
  clusterTrends: mocks.clusterTrends,
  selectPublishingCandidates: mocks.selectPublishingCandidates,
}));
vi.mock("@/lib/pipeline/openai", () => ({
  researchTrend: mocks.researchTrend,
  writeArticle: mocks.writeArticle,
  verifyDraft: mocks.verifyDraft,
  moderateDraft: mocks.moderateDraft,
}));
vi.mock("@/lib/pipeline/repository", () => ({
  persistEditorialDraft: mocks.persistEditorialDraft,
  persistResearchPacket: mocks.persistResearchPacket,
  recentPublishedHeadlines: mocks.recentPublishedHeadlines,
  recordJob: mocks.recordJob,
}));
vi.mock("@/lib/content", () => ({
  getArticles: mocks.getArticles,
}));
vi.mock("@/lib/pipeline/deduplication", () => ({
  findDuplicate: mocks.findDuplicate,
  hasSuspiciousPhraseReuse: mocks.hasSuspiciousPhraseReuse,
}));
vi.mock("@/lib/pipeline/source-policy", () => ({
  hasIndependentSources: mocks.hasIndependentSources,
}));
vi.mock("@/lib/pipeline/research-policy", () => ({
  validateResearchPacket: mocks.validateResearchPacket,
  validateTalkAroundTownPacket: mocks.validateTalkAroundTownPacket,
}));

import { generateEditorialDraft, normalizeDraftCompleteness } from "./editorial-queue";

const candidate: TrendCluster = {
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

const packet: ResearchPacket = {
  topic: "Specific event",
  thesis: "Two sources support a specific technology event.",
  editorialMode: "reported",
  sourceAssessment: "A primary source and an independent report support the central event.",
  uncertaintyNote: "Minor implementation details remain unknown.",
  category: "ai-robotics",
  isForecast: false,
  forecastHorizon: null,
  confidence: "high",
  claims: [{
    claim: "A company announced a technology update.",
    evidenceUrls: ["https://example.com/announcement", "https://news.example/report"],
    agreement: "confirmed",
  }],
  sources: [
    {
      title: "Company announcement",
      publisher: "Example",
      url: "https://example.com/announcement",
      publishedAt: "2026-06-13T00:00:00Z",
      sourceType: "primary",
    },
    {
      title: "Independent report",
      publisher: "Example News",
      url: "https://news.example/report",
      publishedAt: "2026-06-13T00:00:00Z",
      sourceType: "top-tier",
    },
  ],
  disagreements: [],
  sourceSnippets: ["A short source excerpt with enough words to exercise the phrase reuse safety check."],
};

const draft: ArticleDraft = {
  slug: "specific-event",
  title: "A Specific Technology Event Is Moving Forward",
  dek: "Two sources describe a concrete technology development and what it means.",
  editorialMode: "reported",
  uncertaintyNote: "Minor implementation details remain unknown.",
  category: "ai-robotics",
  confidence: "high",
  forecastHorizon: null,
  heroImageAlt: "An editorial illustration of a technology announcement",
  heroImagePrompt: "An editorial illustration of a technology announcement in a newsroom",
  quickTake: [
    "A company announced a specific update.",
    "Independent reporting confirmed the central event.",
    "Some implementation details remain unknown.",
  ],
  sections: [
    { heading: "What happened", paragraphs: [`${"A".repeat(100)}.`] },
    { heading: "What is known", paragraphs: [`${"B".repeat(100)}.`] },
    { heading: "What comes next", paragraphs: [`${"C".repeat(100)}.`] },
  ],
  sources: packet.sources,
};

describe("editorial queue cost ceiling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collectTrendSignals.mockResolvedValue({ items: [], errors: [] });
    mocks.clusterTrends.mockReturnValue([candidate]);
    mocks.selectPublishingCandidates.mockReturnValue([
      candidate,
      { ...candidate, key: "second-event", label: "Second event" },
    ]);
    mocks.hasIndependentSources.mockReturnValue({
      passes: true,
      independentDomains: 2,
      hasAuthoritativeSource: true,
    });
    mocks.validateResearchPacket.mockReturnValue({ passes: true, reasons: [] });
    mocks.validateTalkAroundTownPacket.mockReturnValue({ passes: true, reasons: [] });
    mocks.researchTrend.mockImplementation(async (_candidate, options) => {
      options.onUsage({ inputTokens: 100, outputTokens: 200, totalTokens: 300 });
      return packet;
    });
    mocks.writeArticle.mockImplementation(async (_packet, _breaking, _feedback, options) => {
      options.onUsage({ inputTokens: 300, outputTokens: 400, totalTokens: 700 });
      return draft;
    });
    mocks.verifyDraft.mockImplementation(async (_packet, _draft, options) => {
      options.onUsage({ inputTokens: 500, outputTokens: 10, totalTokens: 510 });
      return { passes: true, report: "PASS" };
    });
    mocks.moderateDraft.mockResolvedValue(true);
    mocks.hasSuspiciousPhraseReuse.mockReturnValue(false);
    mocks.recentPublishedHeadlines.mockResolvedValue([]);
    mocks.getArticles.mockResolvedValue([]);
    mocks.findDuplicate.mockReturnValue(null);
  });

  it("uses one candidate and saves a private draft after exactly three text calls", async () => {
    const result = await generateEditorialDraft();

    expect(result.status).toBe("completed");
    expect(mocks.researchTrend).toHaveBeenCalledTimes(1);
    expect(mocks.researchTrend).toHaveBeenCalledWith(
      candidate,
      expect.objectContaining({ model: "gpt-5.4-mini", searchContextSize: "low" }),
    );
    expect(mocks.writeArticle).toHaveBeenCalledTimes(1);
    expect(mocks.verifyDraft).toHaveBeenCalledTimes(1);
    expect(mocks.persistEditorialDraft).toHaveBeenCalledTimes(1);
    expect(mocks.recordJob).toHaveBeenCalledWith(
      "editorial-draft",
      "completed",
      expect.objectContaining({
        callLimit: 3,
        imageGeneration: false,
        usage: expect.objectContaining({ calls: 3, totalTokens: 1510 }),
      }),
    );
  });

  it("removes only an incomplete trailing fragment when a complete sentence remains", () => {
    const normalized = normalizeDraftCompleteness({
      ...draft,
      dek: `${draft.dek} This fragment trails off without`,
      sections: draft.sections.map((section, index) => ({
        ...section,
        paragraphs: index === 0
          ? [`${section.paragraphs[0]} This fragment also trails off without`]
          : section.paragraphs,
      })),
    });

    expect(normalized?.dek).toBe(draft.dek);
    expect(normalized?.sections[0].paragraphs[0]).toBe(draft.sections[0].paragraphs[0]);
  });
});
