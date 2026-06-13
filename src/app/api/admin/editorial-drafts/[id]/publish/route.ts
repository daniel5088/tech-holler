import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  isAdminAuthenticated,
  isEditorialDraftBearerAuthorized,
  isSameOriginRequest,
} from "@/lib/admin-auth";
import { publishEditorialDraft } from "@/lib/pipeline/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const bearerAuthorized = isEditorialDraftBearerAuthorized(request);
  const dashboardAuthorized = isSameOriginRequest(request) && (await isAdminAuthenticated());
  if (!bearerAuthorized && !dashboardAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const article = await publishEditorialDraft((await params).id);
    revalidatePath("/");
    revalidatePath("/latest");
    revalidatePath(`/category/${article.category}`);
    revalidatePath("/rss.xml");
    revalidatePath("/sitemap.xml");
    revalidatePath(`/article/${article.slug}`);
    if (bearerAuthorized) {
      return NextResponse.json({
        status: "published",
        article: { id: article.id, slug: article.slug, title: article.title },
      });
    }
    return NextResponse.redirect(new URL(`/article/${article.slug}`, request.url), 303);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft publication failed" },
      { status: 400 },
    );
  }
}
