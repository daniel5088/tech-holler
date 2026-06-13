import { NextResponse } from "next/server";
import { publishingEnabled } from "@/lib/env";
import { isAuthorizedCron } from "@/lib/pipeline/auth";
import { hasCompletedJobForSlot } from "@/lib/pipeline/repository";
import { generateEditorialDraft } from "@/lib/pipeline/editorial-queue";

function easternSlot(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    hour: Number(value("hour")),
    slot: `${value("year")}-${value("month")}-${value("day")}-${value("hour")}`,
  };
}

export async function POST(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!publishingEnabled) {
    return NextResponse.json({ status: "paused", reason: "PUBLISHING_ENABLED is false" }, { status: 409 });
  }

  try {
    const url = new URL(request.url);
    const schedule = easternSlot();
    const forced = url.searchParams.get("force") === "true";
    if (!forced && ![7, 13, 19].includes(schedule.hour)) {
      return NextResponse.json({ status: "skipped", reason: "Outside an Eastern draft-generation window" });
    }
    if (!forced && (await hasCompletedJobForSlot("editorial-draft", schedule.slot))) {
      return NextResponse.json({ status: "skipped", reason: "Editorial draft slot already completed" });
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
