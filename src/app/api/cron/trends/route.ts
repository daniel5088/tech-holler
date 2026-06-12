import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/pipeline/auth";
import { runTrendSweep } from "@/lib/pipeline/run";

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runTrendSweep();
    return NextResponse.json({
      signalCount: result.items.length,
      clusterCount: result.clusters.length,
      breakingCandidates: result.clusters.filter((cluster) => cluster.qualifiedForBreaking).slice(0, 10),
      adapterErrors: result.errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Trend sweep failed" },
      { status: 500 },
    );
  }
}
