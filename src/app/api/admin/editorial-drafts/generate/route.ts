import { NextResponse } from "next/server";
import {
  isAdminAuthenticated,
  isEditorialDraftBearerAuthorized,
  isSameOriginRequest,
} from "@/lib/admin-auth";
import { generateEditorialDraft } from "@/lib/pipeline/editorial-queue";

export async function POST(request: Request) {
  const bearerAuthorized = isEditorialDraftBearerAuthorized(request);
  const dashboardAuthorized = isSameOriginRequest(request) && (await isAdminAuthenticated());
  if (!bearerAuthorized && !dashboardAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await generateEditorialDraft();
  if (bearerAuthorized) return NextResponse.json(result);

  const url = new URL("/admin", request.url);
  url.searchParams.set("queueResult", result.status);
  return NextResponse.redirect(url, 303);
}
