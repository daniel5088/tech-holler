import { NextResponse } from "next/server";
import { env, publishingEnabled, supabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  const ready = supabaseConfigured && Boolean(env.ANTHROPIC_API_KEY) && Boolean(env.CRON_SECRET);
  return NextResponse.json(
    {
      status: ready ? "ready" : "setup-required",
      checks: {
        database: supabaseConfigured,
        anthropic: Boolean(env.ANTHROPIC_API_KEY),
        cronAuth: Boolean(env.CRON_SECRET),
        publishingEnabled,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
