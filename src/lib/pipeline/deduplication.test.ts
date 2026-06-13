import { describe, expect, it } from "vitest";
import { findDuplicate, hasSuspiciousPhraseReuse, titleSimilarity } from "./deduplication";

describe("deduplication", () => {
  it("finds substantially equivalent headlines", () => {
    expect(
      titleSimilarity(
        "AI agents move from chat into workplace tools",
        "Workplace AI agents are moving beyond chat tools",
      ),
    ).toBeGreaterThan(0.6);
  });

  it("returns the matching existing article", () => {
    const result = findDuplicate("New home robots still struggle with dexterity", [
      { id: "1", slug: "home-robots-dexterity", title: "Home robots still struggle with dexterity" },
    ]);
    expect(result?.article.id).toBe("1");
  });

  it("detects long copied phrases", () => {
    const phrase = "this exact sequence of ten words should never appear in drafts unchanged";
    expect(hasSuspiciousPhraseReuse(`An intro. ${phrase}. An ending.`, [phrase])).toBe(true);
  });

  it("detects copied phrases despite punctuation changes", () => {
    const source =
      "the company disabled both models for every customer while officials reviewed the directive";
    const draft =
      "The company disabled both models for every customer, while officials reviewed the directive.";
    expect(hasSuspiciousPhraseReuse(draft, [source])).toBe(true);
  });

  it("allows shorter unavoidable factual wording", () => {
    const source =
      "Anthropic disabled Fable 5 and Mythos 5 for all customers after receiving the directive";
    const draft =
      "Anthropic disabled Fable 5 and Mythos 5 for all customers, according to its statement.";
    expect(hasSuspiciousPhraseReuse(draft, [source])).toBe(false);
  });
});
