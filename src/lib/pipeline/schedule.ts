import type { CategorySlug } from "@/types/content";

export const CATEGORY_SCHEDULE: ReadonlyArray<{
  hour: number;
  category: CategorySlug;
  label: string;
}> = [
  { hour: 1, category: "ai-robotics", label: "AI & Robotics" },
  { hour: 5, category: "computing-gadgets", label: "Computing & Gadgets" },
  { hour: 9, category: "cyber-internet", label: "Cyber & Internet" },
  { hour: 13, category: "space-science", label: "Space & Science" },
  { hour: 17, category: "sci-fi-reality", label: "Sci-Fi to Reality" },
  { hour: 21, category: "futurecasting", label: "Futurecasting" },
];

const CATEGORY_SLUGS = new Set<CategorySlug>(
  CATEGORY_SCHEDULE.map(({ category }) => category),
);

function easternParts(date: Date) {
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
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: Number(value("hour")),
  };
}

export function easternCategorySlot(date = new Date()) {
  const { year, month, day, hour } = easternParts(date);
  const assignment = CATEGORY_SCHEDULE.find((entry) => entry.hour === hour);
  if (!assignment) {
    return { hour, category: null, slot: null };
  }
  return {
    hour,
    category: assignment.category,
    slot: `${year}-${month}-${day}-${hour}-${assignment.category}`,
  };
}

export function formatCategorySchedule() {
  return CATEGORY_SCHEDULE.map(({ hour, label }) => {
    const normalized = hour % 12 || 12;
    return `${normalized} ${hour < 12 ? "AM" : "PM"} - ${label}`;
  });
}

export function parseCategorySlug(value: string): CategorySlug | undefined {
  return CATEGORY_SLUGS.has(value as CategorySlug)
    ? value as CategorySlug
    : undefined;
}
