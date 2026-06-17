import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Article } from "@/types/content";

const mocks = vi.hoisted(() => ({ getServiceSupabase: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getServiceSupabase: mocks.getServiceSupabase }));

import { persistArticle } from "./repository";

const article = {
  id: "article-1",
  slug: "talk-around-town-example",
  title: "Talk Around Town: An Example Story",
  dek: "A short standfirst describing the example story in enough words.",
  category: "ai-robotics",
  publishedAt: "2026-06-16T00:00:00.000Z",
  updatedAt: "2026-06-16T00:00:00.000Z",
  readingMinutes: 4,
  author: "Buckley Byte",
  confidence: "low",
  editorialMode: "talk-around-town",
  isBreaking: false,
  trendScore: 80,
  forecastHorizon: undefined,
  heroImageAlt: "An editorial illustration",
  quickTake: ["a", "b", "c"],
  sections: [{ heading: "What is said", paragraphs: ["p"] }],
  sources: [
    { title: "Source", publisher: "Pub", url: "https://example.com/a", publishedAt: "2026-06", sourceType: "primary" },
  ],
} as unknown as Article;

// Builds a fake supabase client. `failInsert` names a table whose insert fails;
// every delete().eq() is recorded so we can assert the rollback.
function makeClient(failInsert?: string) {
  const deletes: { table: string; column: string; value: unknown }[] = [];
  const client = {
    from: (table: string) => ({
      insert: async () => ({ error: failInsert === table ? { message: `boom-${table}` } : null }),
      delete: () => ({
        eq: async (column: string, value: unknown) => {
          deletes.push({ table, column, value });
          return { error: null };
        },
      }),
    }),
  };
  return { client, deletes };
}

describe("persistArticle rollback", () => {
  beforeEach(() => vi.clearAllMocks());

  it("inserts all three rows and rolls back nothing on success", async () => {
    const { client, deletes } = makeClient();
    mocks.getServiceSupabase.mockReturnValue(client);

    await persistArticle(article);

    expect(deletes).toHaveLength(0);
  });

  it("rolls back the committed article row when a dependent insert fails", async () => {
    const { client, deletes } = makeClient("article_sources");
    mocks.getServiceSupabase.mockReturnValue(client);

    await expect(persistArticle(article)).rejects.toMatchObject({ message: "boom-article_sources" });

    // The orphaned article (and any partial children) are deleted by id.
    expect(deletes.map((d) => d.table)).toContain("articles");
    expect(deletes.find((d) => d.table === "articles")).toMatchObject({ column: "id", value: article.id });
  });
});
