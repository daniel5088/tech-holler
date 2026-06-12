import { NextResponse } from "next/server";
import { publishingEnabled } from "@/lib/env";
import { isAuthorizedCron } from "@/lib/pipeline/auth";
import { runPublishingJob } from "@/lib/pipeline/run";

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!publishingEnabled) {
    return NextResponse.json({ status: "paused", reason: "PUBLISHING_ENABLED is false" }, { status: 409 });
  }

  try {
    const result = await runPublishingJob({ type: "breaking", count: 1 });
    return NextResponse.json({
      status: "completed",
      candidateCount: result.candidates.length,
      results: result.results,
      adapterErrors: result.errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Breaking publisher failed" },
      { status: 500 },
    );
  }
}
