import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleDraft } from "./schemas";

const mocks = vi.hoisted(() => ({
  getArticles: vi.fn(),
  findDuplicate: vi.fn(),
  hasSuspiciousPhraseReuse: vi.fn(),
  moderateDraft: vi.fn(),
  persistEditorialDraft: vi.fn(),
  recentPublishedHeadlines: vi.fn(),
  recordJob: vi.fn(),
  hasIndependentSources: vi.fn(),
}));

vi.mock("@/lib/content", () => ({ getArticles: mocks.getArticles }));
vi.mock("@/lib/pipeline/deduplication", () => ({
  findDuplicate: mocks.findDuplicate,
  hasSuspiciousPhraseReuse: mocks.hasSuspiciousPhraseReuse,
}));
vi.mock("@/lib/pipeline/openai", () => ({ moderateDraft: mocks.moderateDraft }));
vi.mock("@/lib/pipeline/repository", () => ({
  persistEditorialDraft: mocks.persistEditorialDraft,
  recentPublishedHeadlines: mocks.recentPublishedHeadlines,
  recordJob: mocks.recordJob,
}));
vi.mock("@/lib/pipeline/source-policy", () => ({
  hasIndependentSources: mocks.hasIndependentSources,
}));

import { queueCuratedDraft } from "./curated-draft";

const draft: ArticleDraft = {
  slug: "spacex-public-debut",
  title: "Talk Around Town: SpaceX's Public Debut Put a Rocket Under the Market",
  dek: "Multiple outlets report a strong first trading day for SpaceX. Our analysis focuses on what changed and what remains uncertain.",
  editorialMode: "talk-around-town",
  uncertaintyNote:
    "First-day prices and valuations can move quickly, and this analysis is not financial advice.",
  category: "space-science",
  confidence: "low",
  forecastHorizon: null,
  heroImageAlt: "Editorial illustration of a rocket rising beside a stock chart",
  heroImagePrompt: "Editorial illustration of a rocket and market chart with no text or logos",
  quickTake: [
    "Several outlets reported that SpaceX shares rose on their first trading day.",
    "A public listing creates new scrutiny alongside new access for investors.",
    "The opening-day excitement does not establish the company's long-term value.",
  ],
  sections: [
    { heading: "What is being reported", paragraphs: [`${"A".repeat(100)}.`] },
    { heading: "What appears solid", paragraphs: [`${"B".repeat(100)}.`] },
    { heading: "Our analysis", paragraphs: [`${"C".repeat(100)}.`] },
  ],
  sources: [{
    title: "SpaceX shares rise in first day of trading",
    publisher: "Axios",
    url: "https://www.axios.com/2026/06/12/spacex-shares-rocket-first-trades",
    publishedAt: "2026-06-12T00:00:00Z",
    sourceType: "top-tier",
  }],
};

describe("curated editorial drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.moderateDraft.mockResolvedValue(true);
    mocks.recentPublishedHeadlines.mockResolvedValue([]);
    mocks.getArticles.mockResolvedValue([]);
    mocks.findDuplicate.mockReturnValue(null);
    mocks.hasSuspiciousPhraseReuse.mockReturnValue(false);
  });

  it("queues editor-written copy without a generative model call", async () => {
    const article = await queueCuratedDraft(draft);

    expect(article.editorialMode).toBe("talk-around-town");
    expect(mocks.persistEditorialDraft).toHaveBeenCalledWith(
      expect.objectContaining({ title: draft.title }),
      expect.objectContaining({ method: "human-curated", generativeCalls: 0 }),
    );
    expect(mocks.recordJob).toHaveBeenCalledWith(
      "curated-draft",
      "completed",
      expect.objectContaining({ generativeCalls: 0 }),
    );
  });

  it("rejects reported copy without independent source support", async () => {
    mocks.hasIndependentSources.mockReturnValue({ passes: false });

    await expect(
      queueCuratedDraft({
        ...draft,
        editorialMode: "reported",
        title: "SpaceX Completed Its First Day of Public Trading",
        confidence: "high",
      }),
    ).rejects.toThrow("independent trustworthy sources");
  });
});
