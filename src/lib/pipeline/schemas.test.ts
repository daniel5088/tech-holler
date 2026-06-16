import { describe, expect, it } from "vitest";
import { z } from "zod";
import { sourceSchema } from "@/lib/pipeline/schemas";

describe("research schemas", () => {
  it("validates URLs without emitting an unsupported format keyword", () => {
    expect(() =>
      sourceSchema.parse({
        title: "Primary source",
        publisher: "Publisher",
        url: "not-a-url",
        publishedAt: "2026-06-13",
        sourceType: "primary",
      }),
    ).toThrow();

    const jsonSchema = z.toJSONSchema(sourceSchema) as {
      properties?: Record<string, unknown>;
    };
    expect(jsonSchema.properties?.url).toEqual({ type: "string" });
  });
});
