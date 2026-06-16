import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDraft, ResearchPacket } from "./schemas";
import type { TrendCluster } from "@/types/content";

const mocks = vi.hoisted(() => ({
  collectTrendSignals: vi.fn(),
  clusterTrends: vi.fn(),
  selectCategoryCandidates: vi.fn(),
  selectPublishingCandidates: vi.fn(),
  researchTrend: vi.fn(),
  writeArticle: vi.fn(),
  verifyDraft: vi.fn(),
  moderateDraft: vi.fn(),
  persistArticle: vi.fn(),
  persistResearchPacket: vi.fn(),
  recentPublishedHeadlines: vi.fn(),
  recordJob: vi.fn(),
  getArticles: vi.fn(),
  findDuplicate: vi.fn(),
  hasSuspiciousPhraseReuse: vi.fn(),
  hasIndependentSources: vi.fn(),
  validateResearchPacket: vi.fn(),
  validateTalkAroundTownPacket: vi.fn(),
  pruneUnsupportedEvidence: vi.fn(),
}));

vi.mock("@/lib/pipeline/adapters", () => ({
  collectTrendSignals: mocks.collectTrendSignals,
}));
vi.mock("@/lib/pipeline/trend-scoring", () => ({
  clusterTrends: mocks.clusterTrends,
  selectCategoryCandidates: mocks.selectCategoryCandidates,
  selectPublishingCandidates: mocks.selectPublishingCandidates,
}));
vi.mock("@/lib/pipeline/anthropic", () => ({
  researchTrend: mocks.researchTrend,
  writeArticle: mocks.writeArticle,
  verifyDraft: mocks.verifyDraft,
  moderateDraft: mocks.moderateDraft,
}));
vi.mock("@/lib/pipeline/repository", () => ({
  persistArticle: mocks.persistArticle,
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
  pruneUnsupportedEvidence: mocks.pruneUnsupportedEvidence,
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
    mocks.selectCategoryCandidates.mockReturnValue([candidate]);
    mocks.hasIndependentSources.mockReturnValue({
      passes: true,
      independentDomains: 2,
      hasAuthoritativeSource: true,
    });
    mocks.validateResearchPacket.mockReturnValue({ passes: true, reasons: [] });
    mocks.validateTalkAroundTownPacket.mockReturnValue({ passes: true, reasons: [] });
    mocks.pruneUnsupportedEvidence.mockImplementation((value) => value);
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

  it("publishes one verified AI article after exactly three text calls", async () => {
    const result = await generateEditorialDraft();

    expect(result.status).toBe("published");
    expect(mocks.researchTrend).toHaveBeenCalledTimes(1);
    expect(mocks.researchTrend).toHaveBeenCalledWith(
      candidate,
      expect.objectContaining({ model: "claude-sonnet-4-6" }),
    );
    expect(mocks.writeArticle).toHaveBeenCalledTimes(1);
    expect(mocks.verifyDraft).toHaveBeenCalledTimes(1);
    expect(mocks.persistArticle).toHaveBeenCalledWith(
      expect.objectContaining({
        id: expect.any(String),
        slug: draft.slug,
        title: draft.title,
      }),
    );
    expect(mocks.recordJob).toHaveBeenCalledWith(
      "editorial-draft",
      "completed",
      expect.objectContaining({
        article: expect.objectContaining({
          id: expect.any(String),
          slug: draft.slug,
          title: draft.title,
        }),
        callLimit: 3,
        imageGeneration: false,
        usage: expect.objectContaining({ calls: 3, totalTokens: 1510 }),
      }),
    );
  });

  it("publishes nothing when verification blocks the AI article", async () => {
    mocks.verifyDraft.mockResolvedValue({ passes: false, report: "Unsupported claim" });

    const result = await generateEditorialDraft();

    expect(result.status).toBe("blocked");
    expect(mocks.persistArticle).not.toHaveBeenCalled();
    expect(mocks.recordJob).toHaveBeenCalledWith(
      "editorial-draft",
      "blocked",
      expect.objectContaining({ reason: "Verification failed" }),
    );
  });

  it.each([
    [
      "candidate selection",
      () => mocks.selectPublishingCandidates.mockReturnValue([]),
      "No candidate passed deterministic preselection",
    ],
    [
      "evidence cleanup",
      () => mocks.pruneUnsupportedEvidence.mockReturnValue(null),
      "Too few correctly mapped claims remain after evidence cleanup",
    ],
    [
      "attribution mapping",
      () => {
        mocks.hasIndependentSources.mockReturnValue({ passes: false });
        mocks.validateResearchPacket.mockReturnValue({ passes: false, reasons: ["weak sources"] });
        mocks.validateTalkAroundTownPacket.mockReturnValue({ passes: false, reasons: ["unmapped claim"] });
      },
      "Attribution mapping failed",
    ],
    [
      "draft completeness",
      () => mocks.writeArticle.mockResolvedValue({ ...draft, dek: "Incomplete fragment" }),
      "Draft contains an incomplete dek or paragraph",
    ],
    [
      "editorial mode labeling",
      () => mocks.writeArticle.mockResolvedValue({ ...draft, editorialMode: "talk-around-town" }),
      "Editorial mode or label mismatch",
    ],
    [
      "source phrase reuse",
      () => mocks.hasSuspiciousPhraseReuse.mockReturnValue(true),
      "Potential source phrase reuse detected",
    ],
    [
      "moderation",
      () => mocks.moderateDraft.mockResolvedValue(false),
      "Moderation gate failed",
    ],
    [
      "duplicate detection",
      () => mocks.findDuplicate.mockReturnValue({ id: "existing", title: draft.title, slug: draft.slug }),
      "Equivalent coverage already exists",
    ],
  ])("publishes nothing when %s blocks the AI article", async (_gate, arrange, reason) => {
    arrange();

    const result = await generateEditorialDraft();

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe(reason);
    expect(mocks.persistArticle).not.toHaveBeenCalled();
  });

  it("blocks before paid research when no candidate matches the target category", async () => {
    mocks.selectCategoryCandidates.mockReturnValue([]);

    const result = await generateEditorialDraft({ category: "space-science" });

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("No candidate matched the scheduled category");
    expect(mocks.researchTrend).not.toHaveBeenCalled();
    expect(mocks.persistArticle).not.toHaveBeenCalled();
  });

  it("publishes a draft under its actual category when research drifts from the slot", async () => {
    mocks.researchTrend.mockResolvedValue({ ...packet, category: "cyber-internet" });
    mocks.writeArticle.mockResolvedValue({ ...draft, category: "cyber-internet" });

    const result = await generateEditorialDraft({ category: "space-science" });

    expect(result.status).toBe("published");
    expect(mocks.persistArticle).toHaveBeenCalledWith(
      expect.objectContaining({ category: "cyber-internet" }),
    );
  });

  it("publishes a targeted article with the scheduled category", async () => {
    mocks.researchTrend.mockResolvedValue({ ...packet, category: "space-science" });
    mocks.writeArticle.mockResolvedValue({ ...draft, category: "space-science" });

    const result = await generateEditorialDraft({
      slot: "2026-06-15-13-space-science",
      category: "space-science",
    });

    expect(result.status).toBe("published");
    expect(mocks.researchTrend).toHaveBeenCalledWith(
      candidate,
      expect.objectContaining({ targetCategory: "space-science" }),
    );
    expect(mocks.persistArticle).toHaveBeenCalledWith(
      expect.objectContaining({ category: "space-science" }),
    );
    expect(mocks.recordJob).toHaveBeenCalledWith(
      "editorial-draft",
      "completed",
      expect.objectContaining({ category: "space-science" }),
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

  it("trims an incomplete trailing quick-take fragment back to its complete sentence", () => {
    const normalized = normalizeDraftCompleteness({
      ...draft,
      quickTake: [
        `${draft.quickTake[0]} This bonus clause trails off without`,
        draft.quickTake[1],
        draft.quickTake[2],
      ],
    });

    expect(normalized?.quickTake[0]).toBe(draft.quickTake[0]);
    expect(normalized?.quickTake[1]).toBe(draft.quickTake[1]);
  });

  it("rejects a draft whose trailing quick-take item is cut off mid-clause", () => {
    const normalized = normalizeDraftCompleteness({
      ...draft,
      quickTake: [
        draft.quickTake[0],
        draft.quickTake[1],
        "OpenHarmony robot launch and the 100-developer giveaway are",
      ],
    });

    expect(normalized).toBeNull();
  });
});
