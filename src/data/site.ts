import type { Category } from "@/types/content";

export const SITE_NAME = "The Tech Holler";
export const SITE_DESCRIPTION =
  "Technology news, science-fiction signals, and future forecasts hollered from Alabama.";

export const categories: Category[] = [
  {
    slug: "ai-robotics",
    name: "AI & Robotics",
    shortName: "AI",
    description: "Machines that think, move, and occasionally make us nervous.",
    accent: "#f45d2d",
  },
  {
    slug: "computing-gadgets",
    name: "Computing & Gadgets",
    shortName: "Gear",
    description: "Chips, devices, and the hardware rattling tomorrow's toolbox.",
    accent: "#5ec7c4",
  },
  {
    slug: "cyber-internet",
    name: "Cyber & Internet",
    shortName: "Cyber",
    description: "Security, platforms, networks, and digital power.",
    accent: "#d7b04b",
  },
  {
    slug: "space-science",
    name: "Space & Science",
    shortName: "Science",
    description: "Research, rockets, and discoveries beyond the fence line.",
    accent: "#8e83d8",
  },
  {
    slug: "sci-fi-reality",
    name: "Sci-Fi to Reality",
    shortName: "Sci-Fi",
    description: "Where fiction, culture, and real engineering swap notes.",
    accent: "#e67faf",
  },
  {
    slug: "futurecasting",
    name: "Futurecasting",
    shortName: "Future",
    description: "Evidence-backed forecasts from next year to the next generation.",
    accent: "#7eb85a",
  },
];

export function getCategory(slug: string) {
  return categories.find((category) => category.slug === slug);
}
