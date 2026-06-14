import { describe, expect, it } from "vitest";
import {
  CATEGORY_SCHEDULE,
  easternCategorySlot,
  formatCategorySchedule,
} from "./schedule";

describe("daily category schedule", () => {
  it("maps six Eastern hours to the six editorial categories", () => {
    expect(CATEGORY_SCHEDULE.map(({ hour, category }) => ({ hour, category }))).toEqual([
      { hour: 1, category: "ai-robotics" },
      { hour: 5, category: "computing-gadgets" },
      { hour: 9, category: "cyber-internet" },
      { hour: 13, category: "space-science" },
      { hour: 17, category: "sci-fi-reality" },
      { hour: 21, category: "futurecasting" },
    ]);
  });

  it("builds a category-specific slot in daylight-saving time", () => {
    expect(easternCategorySlot(new Date("2026-06-14T17:05:00Z"))).toEqual({
      hour: 13,
      category: "space-science",
      slot: "2026-06-14-13-space-science",
    });
  });

  it("builds the same Eastern slot shape in standard time", () => {
    expect(easternCategorySlot(new Date("2026-12-14T18:05:00Z"))).toEqual({
      hour: 13,
      category: "space-science",
      slot: "2026-12-14-13-space-science",
    });
  });

  it("returns no category outside a configured hour", () => {
    expect(easternCategorySlot(new Date("2026-06-14T18:05:00Z"))).toEqual({
      hour: 14,
      category: null,
      slot: null,
    });
  });

  it("formats all schedule entries for the dashboard", () => {
    expect(formatCategorySchedule()).toEqual([
      "1 AM - AI & Robotics",
      "5 AM - Computing & Gadgets",
      "9 AM - Cyber & Internet",
      "1 PM - Space & Science",
      "5 PM - Sci-Fi to Reality",
      "9 PM - Futurecasting",
    ]);
  });
});
