import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { isAdminAuthenticated, isSameOriginRequest } from "@/lib/admin-auth";
import { publishEditorialDraft } from "@/lib/pipeline/repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSameOriginRequest(request) || !(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const article = await publishEditorialDraft((await params).id);
    revalidatePath("/", "layout");
    revalidatePath("/rss.xml");
    revalidatePath(`/article/${article.slug}`);
    return NextResponse.redirect(new URL(`/article/${article.slug}`, request.url), 303);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft publication failed" },
      { status: 400 },
    );
  }
}
