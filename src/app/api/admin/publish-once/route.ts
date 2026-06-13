import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runPublishingJob } from "@/lib/pipeline/run";

export async function POST(request: Request) {
  if (
    !env.MANUAL_PUBLISH_TOKEN ||
    request.headers.get("authorization") !== `Bearer ${env.MANUAL_PUBLISH_TOKEN}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runPublishingJob({ type: "daily", count: 1 });
    return NextResponse.json({
      status: "completed",
      candidateCount: result.candidates.length,
      results: result.results,
      adapterErrors: result.errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Manual publishing failed" },
      { status: 500 },
    );
  }
}
