import { NextResponse } from "next/server";
import { env, publishingEnabled } from "@/lib/env";
import { isAuthorizedCron } from "@/lib/pipeline/auth";
import { hasJobForSlot } from "@/lib/pipeline/repository";
import { generateEditorialDraft } from "@/lib/pipeline/editorial-queue";
import { easternDraftSlot, parseScheduleHours } from "@/lib/pipeline/schedule";

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!publishingEnabled) {
    return NextResponse.json({ status: "paused", reason: "PUBLISHING_ENABLED is false" }, { status: 409 });
  }

  try {
    const url = new URL(request.url);
    const schedule = easternDraftSlot();
    const scheduleHours = parseScheduleHours(env.EDITORIAL_SCHEDULE_HOURS);
    const forced = url.searchParams.get("force") === "true";
    if (!forced && !scheduleHours.includes(schedule.hour)) {
      return NextResponse.json({ status: "skipped", reason: "Outside an Eastern draft-generation window" });
    }
    if (!forced && (await hasJobForSlot("editorial-draft", schedule.slot))) {
      return NextResponse.json({ status: "skipped", reason: "Editorial draft slot already attempted" });
    }
    const result = await generateEditorialDraft({ slot: schedule.slot });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Daily draft generation failed" },
      { status: 500 },
    );
  }
}
