import { describe, expect, it } from "vitest";
import { VERIFICATION_SYSTEM_PROMPT } from "./anthropic";

describe("verification system prompt", () => {
  it("allows strong Alabama voice in every article field", () => {
    expect(VERIFICATION_SYSTEM_PROMPT).toContain(
      "titles, deks, quick-take items, headings, and body paragraphs",
    );
    expect(VERIFICATION_SYSTEM_PROMPT).toContain(
      "Alabama dialect, regional phrasing, jokes, idioms, and rural metaphors",
    );
  });

  it("treats barnyard buzz as figurative style rather than a factual assertion", () => {
    expect(VERIFICATION_SYSTEM_PROMPT).toContain("\"barnyard buzz\"");
    expect(VERIFICATION_SYSTEM_PROMPT).toContain("non-factual stylistic language");
  });

  it("keeps factual and attribution safeguards intact", () => {
    expect(VERIFICATION_SYSTEM_PROMPT).toContain(
      "Do not excuse invented or overstated facts",
    );
    expect(VERIFICATION_SYSTEM_PROMPT).toContain(
      "every unverified assertion remains explicitly attributed",
    );
    expect(VERIFICATION_SYSTEM_PROMPT).toContain(
      "presenting chatter as settled fact",
    );
  });
});
