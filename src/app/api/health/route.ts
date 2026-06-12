import { NextResponse } from "next/server";
import { env, publishingEnabled, supabaseConfigured } from "@/lib/env";

export const dynamic = "force-static";

export function GET() {
  const ready = supabaseConfigured && Boolean(env.OPENAI_API_KEY) && Boolean(env.CRON_SECRET);
  return NextResponse.json(
    {
      status: ready ? "ready" : "setup-required",
      checks: {
        database: supabaseConfigured,
        openai: Boolean(env.OPENAI_API_KEY),
        cronAuth: Boolean(env.CRON_SECRET),
        publishingEnabled,
      },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
