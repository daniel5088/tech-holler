import { z } from "zod";

const urlSchema = z.string().refine((value) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid URL");

export const sourceSchema = z.object({
  title: z.string().min(4),
  publisher: z.string().min(2),
  url: urlSchema,
  publishedAt: z.string(),
  sourceType: z.enum(["primary", "top-tier", "specialist", "social-signal"]),
});

export const researchPacketSchema = z.object({
  topic: z.string(),
  thesis: z.string(),
  category: z.enum([
    "ai-robotics",
    "computing-gadgets",
    "cyber-internet",
    "space-science",
    "sci-fi-reality",
    "futurecasting",
  ]),
  isForecast: z.boolean(),
  forecastHorizon: z.string().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  claims: z.array(
    z.object({
      claim: z.string(),
      evidenceUrls: z.array(urlSchema).min(1),
      agreement: z.enum(["confirmed", "mixed", "uncertain"]).describe(
        "Use confirmed for a directly evidenced fact, including the fact that a named source made an explicitly attributed statement. This does not confirm the underlying allegation. Use uncertain only when the claim itself lacks adequate support.",
      ),
    }),
  ).min(3),
  sources: z.array(sourceSchema).min(2),
  disagreements: z.array(z.string()),
  sourceSnippets: z.array(z.string().min(40).max(300)).min(2).max(8).describe(
    "Short verbatim excerpts of roughly 12 to 24 words copied exactly from the factual sources, used only to detect source-phrase reuse. Never put summaries or paraphrases here.",
  ),
});

export const articleDraftSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().min(20).max(130),
  dek: z.string().min(40).max(260),
  category: researchPacketSchema.shape.category,
  confidence: z.enum(["low", "medium", "high"]),
  forecastHorizon: z.string().nullable(),
  heroImageAlt: z.string().min(20).max(180),
  heroImagePrompt: z.string().min(30).max(700),
  quickTake: z.array(z.string().min(12).max(180)).length(3),
  sections: z.array(
    z.object({
      heading: z.string().min(4).max(100),
      paragraphs: z.array(z.string().min(80).max(1600)).min(1).max(4),
    }),
  ).min(3).max(7),
  sources: z.array(sourceSchema).min(2),
});

export type ResearchPacket = z.infer<typeof researchPacketSchema>;
export type ArticleDraft = z.infer<typeof articleDraftSchema>;
