import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/pipeline/auth";

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    status: "paused",
    reason: "Breaking generation is disabled during the manual editorial-queue phase",
  });
}
