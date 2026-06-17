import { describe, expect, it } from "vitest";
import { clampProse, parseArticleDraft, parseResearchPacket } from "./anthropic";
import { toTimestamptz } from "./repository";

const basePacket = {
  topic: "A specific technology event",
  thesis: "A single company self-reported a technology update.",
  editorialMode: "talk-around-town",
  sourceAssessment: "A".repeat(60),
  uncertaintyNote: "Key specifics remain uncorroborated by independent sources.",
  category: "ai-robotics",
  isForecast: false,
  forecastHorizon: null,
  confidence: "low",
  claims: [
    { claim: "The company announced a thing.", evidenceUrls: ["https://example.com/a"], agreement: "uncertain" },
    { claim: "The company exists.", evidenceUrls: ["https://example.com/b"], agreement: "confirmed" },
  ],
  sources: [
    { title: "Announcement", publisher: "Example", url: "https://example.com/a", publishedAt: "2026-01-01", sourceType: "primary" },
  ],
  disagreements: [],
  sourceSnippets: ["A verbatim source excerpt long enough to clear the forty character minimum floor."],
};

const baseDraft = {
  slug: "talk-around-town-a-specific-event",
  title: "Talk Around Town: A Specific Technology Event Is Reportedly Underway",
  dek: "A company says it did a thing, but independent confirmation has not yet arrived.",
  editorialMode: "talk-around-town",
  uncertaintyNote: "Key specifics remain uncorroborated by independent sources.",
  category: "ai-robotics",
  confidence: "low",
  forecastHorizon: null,
  heroImageAlt: "An editorial illustration of an unconfirmed announcement",
  heroImagePrompt: "A clearly editorial, non-photorealistic illustration of an unconfirmed announcement",
  quickTake: [
    "The company says it shipped a thing, per its own release.",
    "No independent source has confirmed the central claim yet.",
    "Treat the specifics as self-reported until corroborated.",
  ],
  sections: [
    { heading: "What is being said", paragraphs: [`${"A".repeat(100)}.`] },
    { heading: "What is known", paragraphs: [`${"B".repeat(100)}.`] },
    { heading: "What comes next", paragraphs: [`${"C".repeat(100)}.`] },
  ],
  sources: basePacket.sources,
};

describe("clampProse", () => {
  it("returns the value unchanged when within the cap", () => {
    expect(clampProse("short text", 100)).toBe("short text");
  });

  it("clamps to a sentence boundary within the cap when possible", () => {
    const value = "First complete sentence. " + "x".repeat(200);
    const clamped = clampProse(value, 60) as string;
    expect(clamped).toBe("First complete sentence.");
    expect(clamped.length).toBeLessThanOrEqual(60);
  });

  it("falls back to a word boundary when there is no sentence break", () => {
    const clamped = clampProse("alpha beta gamma delta epsilon", 18) as string;
    expect(clamped.length).toBeLessThanOrEqual(18);
    expect(clamped.endsWith(" ")).toBe(false);
  });

  it("passes through non-string values", () => {
    expect(clampProse(42, 10)).toBe(42);
  });
});

describe("parseResearchPacket", () => {
  it("clamps an over-long sourceAssessment so the packet still validates", () => {
    const result = parseResearchPacket(JSON.stringify({ ...basePacket, sourceAssessment: "A".repeat(2000) }));
    expect("packet" in result && result.packet).toBeTruthy();
    if (result.packet) expect(result.packet.sourceAssessment.length).toBeLessThanOrEqual(1500);
  });

  it("drops too-short snippets but keeps valid ones", () => {
    const result = parseResearchPacket(
      JSON.stringify({ ...basePacket, sourceSnippets: ["too short", basePacket.sourceSnippets[0]] }),
    );
    expect(result.packet?.sourceSnippets).toEqual([basePacket.sourceSnippets[0]]);
  });

  it("reports the zod issues instead of throwing on a schema violation", () => {
    const result = parseResearchPacket(JSON.stringify({ ...basePacket, confidence: "bogus" }));
    expect(result.packet).toBeNull();
    if (!result.packet) expect(result.issues).toContain("confidence");
  });

  it("reports invalid JSON rather than crashing", () => {
    const result = parseResearchPacket("{ not valid json ");
    expect(result.packet).toBeNull();
    if (!result.packet) expect(result.issues).toContain("JSON");
  });
});

describe("parseArticleDraft", () => {
  it("clamps an over-long quick-take item so the draft still validates", () => {
    const result = parseArticleDraft(
      JSON.stringify({ ...baseDraft, quickTake: ["Q".repeat(400), baseDraft.quickTake[1], baseDraft.quickTake[2]] }),
    );
    expect(result).not.toBeNull();
    expect(result?.quickTake[0].length).toBeLessThanOrEqual(240);
  });

  it("returns null on an unparseable response", () => {
    expect(parseArticleDraft("no json here")).toBeNull();
  });
});

describe("toTimestamptz", () => {
  it("expands a partial year-month date to a valid ISO timestamp", () => {
    const result = toTimestamptz("2026-06");
    expect(result).not.toBeNull();
    expect(result).toContain("2026-06");
  });

  it("preserves a full date", () => {
    expect(toTimestamptz("2026-06-02")).toBe("2026-06-02T00:00:00.000Z");
  });

  it("returns null for unparseable or empty input", () => {
    expect(toTimestamptz("not a date")).toBeNull();
    expect(toTimestamptz("")).toBeNull();
    expect(toTimestamptz(null)).toBeNull();
    expect(toTimestamptz(undefined)).toBeNull();
  });
});
