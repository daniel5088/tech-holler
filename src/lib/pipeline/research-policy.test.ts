import { describe, expect, it } from "vitest";
import {
  validateResearchPacket,
  validateTalkAroundTownPacket,
} from "./research-policy";
import type { ResearchPacket } from "./schemas";

function packet(): ResearchPacket {
  return {
    topic: "A specific technology event",
    thesis: "Two trusted sources confirm the event and its immediate consequences.",
    editorialMode: "reported",
    sourceAssessment: "A primary source and an independent top-tier report support the central claims.",
    uncertaintyNote: "Minor implementation details remain unknown, but the central event is independently supported.",
    category: "computing-gadgets",
    isForecast: false,
    forecastHorizon: null,
    confidence: "high",
    claims: [
      {
        claim: "The company announced the product.",
        evidenceUrls: ["https://apple.com/newsroom/example"],
        agreement: "confirmed",
      },
      {
        claim: "Independent reporting confirmed the launch date.",
        evidenceUrls: ["https://reuters.com/technology/example"],
        agreement: "confirmed",
      },
      {
        claim: "The product will be available in the United States.",
        evidenceUrls: [
          "https://apple.com/newsroom/example",
          "https://reuters.com/technology/example",
        ],
        agreement: "confirmed",
      },
    ],
    sources: [
      {
        title: "Company announcement",
        publisher: "Apple",
        url: "https://apple.com/newsroom/example",
        publishedAt: "2026-06-13T00:00:00Z",
        sourceType: "primary",
      },
      {
        title: "Independent report",
        publisher: "Reuters",
        url: "https://reuters.com/technology/example",
        publishedAt: "2026-06-13T00:00:00Z",
        sourceType: "top-tier",
      },
    ],
    disagreements: [],
    sourceSnippets: [
      "The company announced that the product will become available to customers in the United States this month.",
    ],
  };
}

describe("research packet policy", () => {
  it("accepts claims mapped to listed trusted factual sources", () => {
    expect(validateResearchPacket(packet())).toEqual(
      expect.objectContaining({ passes: true, evidenceDomains: 2 }),
    );
  });

  it("rejects an evidence URL that is absent from the source list", () => {
    const value = packet();
    value.claims[0].evidenceUrls = ["https://example.com/unsupported"];

    expect(validateResearchPacket(value)).toEqual(
      expect.objectContaining({
        passes: false,
        unsupportedClaims: expect.arrayContaining([
          expect.objectContaining({ claim: value.claims[0].claim }),
        ]),
      }),
    );
  });

  it("rejects listed factual sources that support no claim", () => {
    const value = packet();
    value.sources.push({
      title: "Unused report",
      publisher: "BBC",
      url: "https://bbc.com/news/unused",
      publishedAt: "2026-06-13T00:00:00Z",
      sourceType: "top-tier",
    });

    expect(validateResearchPacket(value)).toEqual(
      expect.objectContaining({
        passes: false,
        unreferencedSources: ["https://bbc.com/news/unused"],
      }),
    );
  });

  it("allows attributed single-source chatter in Talk Around Town mode", () => {
    const value = packet();
    value.editorialMode = "talk-around-town";
    value.confidence = "low";
    value.sources = [{
      title: "Unverified community post",
      publisher: "Community forum",
      url: "https://community.example/post",
      publishedAt: "2026-06-13T00:00:00Z",
      sourceType: "social-signal",
    }];
    value.claims = [{
      claim: "A community post claims a new device is being tested.",
      evidenceUrls: ["https://community.example/post"],
      agreement: "uncertain",
    }, {
      claim: "The post does not provide independent test results.",
      evidenceUrls: ["https://community.example/post"],
      agreement: "confirmed",
    }];
    value.sourceAssessment =
      "This is one unverified community post with no independent reporting or primary documentation.";
    value.uncertaintyNote =
      "The underlying device claim has not been independently verified and may be incomplete or wrong.";

    expect(validateTalkAroundTownPacket(value)).toEqual(
      expect.objectContaining({ passes: true, evidenceDomains: 1 }),
    );
    expect(validateResearchPacket(value).passes).toBe(false);
  });
});
