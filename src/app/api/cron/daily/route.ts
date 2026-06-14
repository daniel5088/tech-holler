import { NextResponse } from "next/server";
import { publishingEnabled } from "@/lib/env";
import { isAuthorizedCron } from "@/lib/pipeline/auth";
import { hasJobForSlot } from "@/lib/pipeline/repository";
import { generateEditorialDraft } from "@/lib/pipeline/editorial-queue";
import {
  easternCategorySlot,
  parseCategorySlug,
} from "@/lib/pipeline/schedule";

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!publishingEnabled) {
    return NextResponse.json({ status: "paused", reason: "PUBLISHING_ENABLED is false" }, { status: 409 });
  }

  try {
    const url = new URL(request.url);
    const forced = url.searchParams.get("force") === "true";
    const categoryParam = url.searchParams.get("category");
    const forcedCategory = categoryParam
      ? parseCategorySlug(categoryParam)
      : undefined;
    if (forced && categoryParam && !forcedCategory) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (forced) {
      const result = await generateEditorialDraft(
        forcedCategory ? { category: forcedCategory } : {},
      );
      return NextResponse.json(result);
    }

    const schedule = easternCategorySlot();
    if (!schedule.category || !schedule.slot) {
      return NextResponse.json({
        status: "skipped",
        reason: "Outside an Eastern category publishing window",
      });
    }
    if (await hasJobForSlot("editorial-draft", schedule.slot)) {
      return NextResponse.json({
        status: "skipped",
        reason: "Editorial category slot already attempted",
      });
    }
    const result = await generateEditorialDraft({
      slot: schedule.slot,
      category: schedule.category,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily draft generation failed" },
      { status: 500 },
    );
  }
}
