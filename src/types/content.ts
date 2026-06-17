export type CategorySlug =
  | "ai-robotics"
  | "computing-gadgets"
  | "cyber-internet"
  | "space-science"
  | "sci-fi-reality"
  | "futurecasting";

export type Confidence = "low" | "medium" | "high";
export type EditorialMode = "reported" | "talk-around-town";

export interface Category {
  slug: CategorySlug;
  name: string;
  shortName: string;
  description: string;
  accent: string;
}

export interface ArticleSource {
  title: string;
  publisher: string;
  url: string;
  publishedAt: string;
  sourceType: "primary" | "top-tier" | "specialist" | "social-signal";
}

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  dek: string;
  category: CategorySlug;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number;
  author: string;
  confidence: Confidence;
  editorialMode?: EditorialMode;
  uncertaintyNote?: string;
  isBreaking: boolean;
  isDemo?: boolean;
  trendScore: number;
  forecastHorizon?: string;
  heroImageUrl?: string;
  heroImageAlt: string;
  quickTake: string[];
  sections: ArticleSection[];
  sources: ArticleSource[];
  revisionNote?: string;
  likeCount: number;
}

export interface TrendItem {
  id: string;
  title: string;
  url: string;
  channel: "google-trends" | "google-news" | "hacker-news" | "bluesky" | "mastodon" | "youtube";
  capturedAt: string;
  engagement: number;
  velocity: number;
  credibility: number;
  relevance: number;
}

export interface TrendCluster {
  key: string;
  label: string;
  items: TrendItem[];
  score: number;
  channels: number;
  factualSignals: number;
  hasGoogleNews: boolean;
  selectionScore: number;
  qualifiedForBreaking: boolean;
}
