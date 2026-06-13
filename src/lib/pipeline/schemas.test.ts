import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import { sourceSchema } from "@/lib/pipeline/schemas";

describe("OpenAI response schemas", () => {
  it("validates URLs without emitting the unsupported uri format", () => {
    expect(() =>
      sourceSchema.parse({
        title: "Primary source",
        publisher: "Publisher",
        url: "not-a-url",
        publishedAt: "2026-06-13",
        sourceType: "primary",
      }),
    ).toThrow();

    const format = zodTextFormat(sourceSchema, "source");
    expect(format.schema.properties?.url).toEqual({ type: "string" });
  });
});
