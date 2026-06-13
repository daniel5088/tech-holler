import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: optionalUrl,
  NEXT_PUBLIC_BASE_PATH: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_WRITING_MODEL: z.string().default("gpt-5.5"),
  OPENAI_UTILITY_MODEL: z.string().default("gpt-5.4-mini"),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-2"),
  YOUTUBE_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  ADMIN_DASHBOARD_TOKEN: z.string().optional(),
  MANUAL_PUBLISH_TOKEN: z.string().optional(),
  PUBLISHING_ENABLED: z.enum(["true", "false"]).default("false"),
  SOURCE_ALLOWLIST: z.string().optional(),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_WRITING_MODEL: process.env.OPENAI_WRITING_MODEL,
  OPENAI_UTILITY_MODEL: process.env.OPENAI_UTILITY_MODEL,
  OPENAI_IMAGE_MODEL: process.env.OPENAI_IMAGE_MODEL,
  YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  CRON_SECRET: process.env.CRON_SECRET,
  ADMIN_DASHBOARD_TOKEN: process.env.ADMIN_DASHBOARD_TOKEN,
  MANUAL_PUBLISH_TOKEN: process.env.MANUAL_PUBLISH_TOKEN,
  PUBLISHING_ENABLED: process.env.PUBLISHING_ENABLED,
  SOURCE_ALLOWLIST: process.env.SOURCE_ALLOWLIST,
});

export const siteUrl = env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const basePath = env.NEXT_PUBLIC_BASE_PATH || "";
export const publicUrl = (path: string) =>
  path.startsWith("/") ? `${basePath}${path}` : path;
export const publishingEnabled = env.PUBLISHING_ENABLED === "true";
export const supabaseConfigured = Boolean(
  env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY,
);
