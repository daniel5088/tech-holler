import type { TrendCluster, TrendItem } from "@/types/content";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "at", "for", "from", "in", "is", "of", "on", "the", "to", "with",
]);

export function normalizeTopic(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, 6)
    .sort()
    .join("-");
}

export function scoreTrendItem(item: TrendItem) {
  const score =
    item.velocity * 0.35 +
    item.engagement * 0.2 +
    item.credibility * 0.2 +
    item.relevance * 0.25;
  return Math.round(Math.max(0, Math.min(100, score)));
}

export function clusterTrends(items: TrendItem[]): TrendCluster[] {
  const groups = new Map<string, TrendItem[]>();

  for (const item of items) {
    const key = normalizeTopic(item.title);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return [...groups.entries()]
    .map(([key, groupedItems]) => {
      const channels = new Set(groupedItems.map((item) => item.channel)).size;
      const baseScore =
        groupedItems.reduce((sum, item) => sum + scoreTrendItem(item), 0) /
        groupedItems.length;
      const crossChannelBonus = Math.min(20, (channels - 1) * 10);
      const score = Math.round(Math.min(100, baseScore + crossChannelBonus));

      return {
        key,
        label: groupedItems[0].title.slice(0, 180),
        items: groupedItems,
        score,
        channels,
        qualifiedForBreaking: channels >= 2 && score >= 72,
      };
    })
    .sort((a, b) => b.score - a.score);
}
