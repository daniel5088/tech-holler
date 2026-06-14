export function parseScheduleHours(value: string) {
  return [...new Set(
    value
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23),
  )].sort((left, right) => left - right);
}

export function formatScheduleHours(hours: number[]) {
  return hours.map((hour) => {
    const normalized = hour % 12 || 12;
    return `${normalized} ${hour < 12 ? "AM" : "PM"}`;
  }).join(", ");
}

export function easternDraftSlot(date = new Date()) {
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
  const hour = Number(value("hour"));
  return {
    hour,
    slot: `${value("year")}-${value("month")}-${value("day")}-${hour}`,
  };
}
