import { describe, expect, it } from "vitest";
import { easternDraftSlot, formatScheduleHours, parseScheduleHours } from "./schedule";

describe("editorial schedule", () => {
  it("parses, sorts, and deduplicates valid Eastern hours", () => {
    expect(parseScheduleHours("19, 7,7,25,nope")).toEqual([7, 19]);
  });

  it("uses America/New_York across daylight-saving time", () => {
    expect(easternDraftSlot(new Date("2026-06-14T11:05:00Z"))).toEqual({
      hour: 7,
      slot: "2026-06-14-7",
    });
    expect(easternDraftSlot(new Date("2026-12-14T12:05:00Z"))).toEqual({
      hour: 7,
      slot: "2026-12-14-7",
    });
  });

  it("formats schedule hours for the dashboard", () => {
    expect(formatScheduleHours([0, 7, 13, 19])).toBe("12 AM, 7 AM, 1 PM, 7 PM");
  });
});
