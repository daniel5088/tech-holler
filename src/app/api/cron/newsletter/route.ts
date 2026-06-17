import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/pipeline/auth";
import { sendDigest } from "@/lib/newsletter";

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await sendDigest();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Digest failed" },
      { status: 500 },
    );
  }
}
