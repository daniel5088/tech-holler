import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  NEXT_PUBLIC_BASE_PATH: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_WRITING_MODEL: z.string().default("claude-opus-4-8"),
  ANTHROPIC_UTILITY_MODEL: z.string().default("claude-haiku-4-5"),
  ANTHROPIC_EDITORIAL_MODEL: z.string().default("claude-sonnet-4-6"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_WRITING_MODEL: z.string().default("gpt-5.5"),
  OPENAI_UTILITY_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_EDITORIAL_MODEL: z.string().default("gpt-5.4-mini"),
  EDITORIAL_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(1000).max(12000).default(5000),
  YOUTUBE_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ADMIN_DASHBOARD_TOKEN: z.string().optional(),
  EDITORIAL_DRAFT_TOKEN: z.string().optional(),
  PUBLISHING_ENABLED: z.enum(["true", "false"]).default("false"),
  SOURCE_ALLOWLIST: z.string().optional(),
  BLUESKY_IDENTIFIER: z.string().optional(),
  BLUESKY_APP_PASSWORD: z.string().optional(),
  BLUESKY_SERVICE_URL: z.string().default("https://bsky.social"),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_WRITING_MODEL: process.env.ANTHROPIC_WRITING_MODEL,
  ANTHROPIC_UTILITY_MODEL: process.env.ANTHROPIC_UTILITY_MODEL,
  ANTHROPIC_EDITORIAL_MODEL: process.env.ANTHROPIC_EDITORIAL_MODEL,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_WRITING_MODEL: process.env.OPENAI_WRITING_MODEL,
  OPENAI_UTILITY_MODEL: process.env.OPENAI_UTILITY_MODEL,
  OPENAI_EDITORIAL_MODEL: process.env.OPENAI_EDITORIAL_MODEL,
  EDITORIAL_MAX_OUTPUT_TOKENS: process.env.EDITORIAL_MAX_OUTPUT_TOKENS,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  ADMIN_DASHBOARD_TOKEN: process.env.ADMIN_DASHBOARD_TOKEN,
  EDITORIAL_DRAFT_TOKEN: process.env.EDITORIAL_DRAFT_TOKEN,
  PUBLISHING_ENABLED: process.env.PUBLISHING_ENABLED,
  SOURCE_ALLOWLIST: process.env.SOURCE_ALLOWLIST,
  BLUESKY_IDENTIFIER: process.env.BLUESKY_IDENTIFIER,
  BLUESKY_APP_PASSWORD: process.env.BLUESKY_APP_PASSWORD,
  BLUESKY_SERVICE_URL: process.env.BLUESKY_SERVICE_URL,
});

export const siteUrl = env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const basePath = env.NEXT_PUBLIC_BASE_PATH || "";
export const publicUrl = (path: string) =>
  path.startsWith("/") ? `${basePath}${path}` : path;
export const siteRedirectUrl = (path: string, origin = siteUrl) => new URL(path, origin);
export const publishingEnabled = env.PUBLISHING_ENABLED === "true";
export const supabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
);
export const blueskyConfigured = Boolean(
  env.BLUESKY_IDENTIFIER && env.BLUESKY_APP_PASSWORD,
);
export const hasAnthropic = Boolean(env.ANTHROPIC_API_KEY);
export const hasOpenAI = Boolean(env.OPENAI_API_KEY);
export const aiProvider = hasAnthropic ? "anthropic" : hasOpenAI ? "openai" : null;
export const editorialModelName = aiProvider === "anthropic"
  ? env.ANTHROPIC_EDITORIAL_MODEL
  : aiProvider === "openai"
    ? env.OPENAI_EDITORIAL_MODEL
    : null;
