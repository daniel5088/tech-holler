import type { CategorySlug, TrendCluster, TrendItem } from "@/types/content";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on",
  "or", "the", "to", "with",
]);
const FACTUAL_CHANNELS = new Set<TrendItem["channel"]>(["google-news", "hacker-news"]);
const DISCOVERY_ONLY_CHANNELS = new Set<TrendItem["channel"]>(["bluesky", "mastodon"]);
const BROAD_TOPIC_WORDS = new Set([
  "ai", "artificial", "intelligence", "tech", "technology", "robot", "robotics", "space",
  "science", "computer", "computing", "internet", "cyber", "software", "hardware",
]);
const CONCRETE_DEVELOPMENT =
  /\b(announc(?:e|ed|es)|approv(?:e|ed|es)|ban(?:s|ned)?|breach(?:ed)?|confirm(?:s|ed)?|delay(?:s|ed)?|directive|file(?:s|d)?|investigat(?:e|es|ed|ion)|launch(?:es|ed)?|offline|recall(?:s|ed)?|regulator(?:s|y)?|release(?:s|d)?|report(?:s|ed)?|scrutiny|sue(?:s|d)?|suspend(?:s|ed)?|unveil(?:s|ed)?|update(?:s|d)?|vulnerabilit(?:y|ies))\b/i;
const LOW_NEWS_VALUE =
  /\b(career|daily \d+|degree|explains?|forum|graduate programs?|guide|how to|insights|meet the|promises focus|students?|things to know|tips?|top \d+|what is)\b/i;
const PROMOTIONAL_LANGUAGE =
  /\b(challenging the .* titans|game.?changer|huge market|pipeline with|redefine|revolutioniz(?:e|es|ing))\b/i;
const TRUSTED_PUBLISHER_HINT =
  /(?:^| - )(Reuters|Associated Press|AP News|BBC|NPR|Bloomberg|CNBC|Financial Times|The New York Times|The Washington Post|Ars Technica|The Verge|Wired|TechCrunch|Nature|Science|MIT Technology Review|IEEE|NASA|NIST|CISA|Department of Energy)(?:\s|$|\()/i;

const CATEGORY_SIGNALS: Record<CategorySlug, {
  strong: RegExp[];
  supporting: RegExp[];
}> = {
  "ai-robotics": {
    strong: [
      /\bartificial intelligence\b/i,
      /\bmachine learning\b/i,
      /\bopenai\b/i,
      /\brobot(?:s|ics)?\b/i,
      /\bautonomous (?:agent|machine|system|vehicle)s?\b/i,
      /\b(?:reasoning|language|foundation|neural) model\b/i,
      /\bchatbot\b/i,
    ],
    supporting: [/\bai\b/i, /\bautomation\b/i, /\bneural\b/i],
  },
  "computing-gadgets": {
    strong: [
      /\bsemiconductor\b/i,
      /\bprocessor\b/i,
      /\bgpu\b/i,
      /\bcpu\b/i,
      /\blaptop\b/i,
      /\bsmartphone\b/i,
      /\btablet\b/i,
      /\bconsumer device\b/i,
      /\bhardware\b/i,
    ],
    supporting: [/\bchip\b/i, /\bdevice\b/i, /\bgadget\b/i, /\bcomputer\b/i],
  },
  "cyber-internet": {
    strong: [
      /\bcybersecurity\b/i,
      /\bdata breach\b/i,
      /\bvulnerabilit(?:y|ies)\b/i,
      /\bmalware\b/i,
      /\bransomware\b/i,
      /\bcisa\b/i,
      /\bauthentication\b/i,
      /\bnetwork security\b/i,
    ],
    supporting: [/\bbreach\b/i, /\bsecurity\b/i, /\bcloud\b/i, /\binternet\b/i, /\bnetwork\b/i],
  },
  "space-science": {
    strong: [
      /\bnasa\b/i,
      /\bspacecraft\b/i,
      /\brocket\b/i,
      /\blunar\b/i,
      /\bmars\b/i,
      /\btelescope\b/i,
      /\bartemis\b/i,
      /\bresearchers? discover\b/i,
      /\bscientists?\b/i,
    ],
    supporting: [/\bspace\b/i, /\bmission\b/i, /\bscience\b/i, /\borbit\b/i],
  },
  "sci-fi-reality": {
    strong: [
      /\bscience fiction\b/i,
      /\bsci-?fi\b/i,
      /\bstar trek\b/i,
      /\bstar wars\b/i,
      /\bcommunicator\b/i,
      /\bexoskeleton\b/i,
      /\bteleport(?:ation|er|ing)?\b/i,
      /\bfiction inspires?\b/i,
      /\buniversal translator\b/i,
    ],
    supporting: [/\bprototype\b/i, /\bfuturistic\b/i],
  },
  futurecasting: {
    strong: [
      /\bforecast(?:s|ed|ing)?\b/i,
      /\bprediction(?:s)?\b/i,
      /\bby 20\d{2}\b/i,
      /\bfuture of\b/i,
      /\bcould become\b/i,
      /\bnext decade\b/i,
      /\boutlook\b/i,
    ],
    supporting: [/\bcould\b/i, /\bexpected to\b/i, /\blong-term\b/i],
  },
};

function topicTokens(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, 16);
}

export function normalizeTopic(title: string) {
  return topicTokens(title)
    .slice(0, 6)
    .sort()
    .join("-");
}

function topicSimilarity(left: string, right: string) {
  const leftTokens = new Set(topicTokens(left));
  const rightTokens = new Set(topicTokens(right));
  const common = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  if (common < 3) return 0;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  const containment = common / Math.min(leftTokens.size, rightTokens.size);
  return Math.max(common / union, containment * 0.8);
}

function looksLikeSpecificNews(title: string) {
  const tokens = topicTokens(title);
  const specificTokens = tokens.filter((token) => !BROAD_TOPIC_WORDS.has(token));
  return tokens.length >= 5 && tokens.length <= 24 && specificTokens.length >= 3;
}

function looksLikeConcreteDevelopment(title: string) {
  return CONCRETE_DEVELOPMENT.test(title);
}

export function editorialNewsworthiness(title: string) {
  let score = 0;
  if (looksLikeConcreteDevelopment(title)) score += 18;
  if (TRUSTED_PUBLISHER_HINT.test(title)) score += 14;
  if (LOW_NEWS_VALUE.test(title)) score -= 24;
  if (PROMOTIONAL_LANGUAGE.test(title)) score -= 18;
  return score;
}

function preferredLabel(items: TrendItem[]) {
  return [...items].sort((left, right) => {
    const channelRank = (item: TrendItem) =>
      item.channel === "google-news" ? 3 : item.channel === "hacker-news" ? 2 : 1;
    return channelRank(right) - channelRank(left) || scoreTrendItem(right) - scoreTrendItem(left);
  })[0].title.slice(0, 180);
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
  const groups: TrendItem[][] = [];

  for (const item of items) {
    if (!normalizeTopic(item.title)) continue;
    let bestGroup: TrendItem[] | undefined;
    let bestSimilarity = 0;
    for (const group of groups) {
      const similarity = Math.max(...group.map((candidate) => topicSimilarity(item.title, candidate.title)));
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestGroup = group;
      }
    }
    if (bestGroup && bestSimilarity >= 0.52) {
      bestGroup.push(item);
    } else {
      groups.push([item]);
    }
  }

  return groups
    .map((groupedItems) => {
      const channels = new Set(groupedItems.map((item) => item.channel)).size;
      const factualSignals = groupedItems.filter((item) => FACTUAL_CHANNELS.has(item.channel)).length;
      const hasGoogleNews = groupedItems.some((item) => item.channel === "google-news");
      const specificNewsSignals = groupedItems.filter(
        (item) => FACTUAL_CHANNELS.has(item.channel) && looksLikeSpecificNews(item.title),
      ).length;
      const baseScore =
        groupedItems.reduce((sum, item) => sum + scoreTrendItem(item), 0) /
        groupedItems.length;
      const crossChannelBonus = Math.min(20, (channels - 1) * 10);
      const score = Math.round(Math.min(100, baseScore + crossChannelBonus));
      const discoveryOnly = groupedItems.every((item) => DISCOVERY_ONLY_CHANNELS.has(item.channel));
      const vaguePenalty = specificNewsSignals === 0 ? 35 : 0;
      const discoveryPenalty = discoveryOnly ? 30 : 0;
      const newsworthiness = Math.max(
        ...groupedItems
          .filter((item) => FACTUAL_CHANNELS.has(item.channel))
          .map((item) => editorialNewsworthiness(item.title)),
        -30,
      );
      const selectionScore = Math.round(
        score +
        (hasGoogleNews ? 22 : 0) +
        Math.min(18, factualSignals * 6) +
        Math.min(12, (channels - 1) * 6) -
        vaguePenalty -
        discoveryPenalty +
        newsworthiness,
      );
      const label = preferredLabel(groupedItems);

      return {
        key: normalizeTopic(label),
        label,
        items: groupedItems,
        score,
        channels,
        factualSignals,
        hasGoogleNews,
        selectionScore,
        qualifiedForBreaking:
          channels >= 2 &&
          factualSignals >= 1 &&
          specificNewsSignals >= 1 &&
          score >= 72,
      };
    })
    .sort((a, b) => b.selectionScore - a.selectionScore);
}

export function selectPublishingCandidates(
  clusters: TrendCluster[],
  type: "daily" | "breaking",
) {
  return clusters
    .filter((cluster) => {
      if (type === "breaking") return cluster.qualifiedForBreaking;
      return (
        cluster.score >= 55 &&
        cluster.factualSignals >= 1 &&
        cluster.selectionScore >= 65 &&
        (
          looksLikeConcreteDevelopment(cluster.label) ||
          cluster.channels >= 2 ||
          cluster.factualSignals >= 2
        )
      );
    })
    .sort((left, right) => right.selectionScore - left.selectionScore);
}

export function classifyTrendCategory(cluster: TrendCluster): CategorySlug | null {
  const text = [cluster.label, ...cluster.items.map((item) => item.title)].join("\n");
  const scores = Object.entries(CATEGORY_SIGNALS).map(([category, signals]) => ({
    category: category as CategorySlug,
    score:
      signals.strong.reduce((score, pattern) => score + (pattern.test(text) ? 3 : 0), 0) +
      signals.supporting.reduce((score, pattern) => score + (pattern.test(text) ? 1 : 0), 0),
  })).sort((left, right) => right.score - left.score);

  const [best, second] = scores;
  if (!best || best.score < 3 || best.score - (second?.score ?? 0) < 2) return null;
  return best.category;
}

export function selectCategoryCandidates(
  clusters: TrendCluster[],
  category: CategorySlug,
) {
  return selectPublishingCandidates(clusters, "daily")
    .filter((cluster) => classifyTrendCategory(cluster) === category);
}
