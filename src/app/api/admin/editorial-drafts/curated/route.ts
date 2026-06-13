import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isAdminAuthenticated,
  isEditorialDraftBearerAuthorized,
  isSameOriginRequest,
} from "@/lib/admin-auth";
import { queueCuratedDraft } from "@/lib/pipeline/curated-draft";
import { articleDraftSchema } from "@/lib/pipeline/schemas";

const requestSchema = z.object({
  draft: articleDraftSchema,
  sourceSnippets: z.array(z.string().min(40).max(300)).max(8).default([]),
});

export async function POST(request: Request) {
  const bearerAuthorized = isEditorialDraftBearerAuthorized(request);
  const dashboardAuthorized = isSameOriginRequest(request) && (await isAdminAuthenticated());
  if (!bearerAuthorized && !dashboardAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const input = requestSchema.parse(await request.json());
    const article = await queueCuratedDraft(input.draft, input.sourceSnippets);
    return NextResponse.json({
      status: "completed",
      draft: { id: article.id, slug: article.slug, title: article.title },
      generativeCalls: 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Curated draft failed" },
      { status: 400 },
    );
  }
}
