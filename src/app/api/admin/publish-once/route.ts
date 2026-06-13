import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { runPublishingJob } from "@/lib/pipeline/run";
import { getServiceSupabase } from "@/lib/supabase";

function isAuthorized(request: Request) {
  return Boolean(
    env.MANUAL_PUBLISH_TOKEN &&
    request.headers.get("authorization") === `Bearer ${env.MANUAL_PUBLISH_TOKEN}`,
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }
  const { data, error } = await supabase
    .from("research_packets")
    .select("trend_key,packet,source_gate_passed,created_at")
    .order("created_at", { ascending: false })
    .limit(6);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ packets: data });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
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
