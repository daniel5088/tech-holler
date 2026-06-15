import { NextResponse } from "next/server";
import { aiProvider, env, hasAnthropic, hasOpenAI, publishingEnabled, supabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const ready = supabaseConfigured && Boolean(aiProvider) && Boolean(env.CRON_SECRET);
  return NextResponse.json(
    {
      status: ready ? "ready" : "setup-required",
      checks: {
        database: supabaseConfigured,
        anthropic: hasAnthropic,
        openai: hasOpenAI,
        aiProvider,
        cronAuth: Boolean(env.CRON_SECRET),
        publishingEnabled,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
