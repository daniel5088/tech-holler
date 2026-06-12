import Parser from "rss-parser";
import { env } from "@/lib/env";
import type { TrendItem } from "@/types/content";

const parser = new Parser();
const USER_AGENT = "TheTechHoller/1.0 (trend research; contact configured by operator)";

function cleanSignal(value: string) {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).hostname}`);
  return response.json() as Promise<T>;
}

async function fetchRss(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`${response.status} from ${new URL(url).hostname}`);
  return parser.parseString(await response.text());
}

function rssItems(
  feed: Awaited<ReturnType<typeof fetchRss>>,
  channel: TrendItem["channel"],
  credibility: number,
) {
  const capturedAt = new Date().toISOString();
  return feed.items.slice(0, 25).flatMap<TrendItem>((item, index) => {
    if (!item.title || !item.link) return [];
    return [{
      id: `${channel}-${Buffer.from(item.link).toString("base64url").slice(0, 32)}`,
      title: cleanSignal(item.title),
      url: item.link,
      channel,
      capturedAt,
      engagement: Math.max(25, 75 - index * 2),
      velocity: Math.max(30, 92 - index * 3),
      credibility,
      relevance: 78,
    }];
  });
}

async function googleTrends(): Promise<TrendItem[]> {
  const feed = await fetchRss("https://trends.google.com/trending/rss?geo=US");
  return rssItems(feed, "google-trends", 45);
}

async function googleNews(): Promise<TrendItem[]> {
  const feed = await fetchRss(
    "https://news.google.com/rss/search?q=technology+OR+artificial+intelligence+OR+space&hl=en-US&gl=US&ceid=US:en",
  );
  return rssItems(feed, "google-news", 60);
}

async function hackerNews(): Promise<TrendItem[]> {
  const ids = await fetchJson<number[]>("https://hacker-news.firebaseio.com/v0/topstories.json");
  const stories = await Promise.all(
    ids.slice(0, 30).map((id) =>
      fetchJson<{ id: number; title?: string; url?: string; score?: number; descendants?: number }>(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
      ),
    ),
  );
  const capturedAt = new Date().toISOString();

  return stories.flatMap((story, index) => {
    if (!story.title || !story.url) return [];
    return [{
      id: `hacker-news-${story.id}`,
      title: cleanSignal(story.title),
      url: story.url,
      channel: "hacker-news" as const,
      capturedAt,
      engagement: Math.min(100, Math.round((story.score ?? 0) / 5 + (story.descendants ?? 0) / 8)),
      velocity: Math.max(35, 90 - index * 2),
      credibility: 40,
      relevance: 85,
    }];
  });
}

async function bluesky(): Promise<TrendItem[]> {
  const queries = ["artificial intelligence", "technology", "space science"];
  const responses = await Promise.all(
    queries.map((query) =>
      fetchJson<{
        posts: Array<{
          uri: string;
          author: { handle: string };
          record: { text?: string; createdAt?: string };
          likeCount?: number;
          repostCount?: number;
          replyCount?: number;
        }>;
      }>(
        `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${encodeURIComponent(query)}&limit=15&sort=top`,
      ),
    ),
  );

  return responses.flatMap((response) =>
    response.posts.flatMap((post) => {
      if (!post.record.text) return [];
      const postId = post.uri.split("/").pop();
      return [{
        id: `bluesky-${postId}`,
        title: cleanSignal(post.record.text),
        url: `https://bsky.app/profile/${post.author.handle}/post/${postId}`,
        channel: "bluesky" as const,
        capturedAt: new Date().toISOString(),
        engagement: Math.min(100, (post.likeCount ?? 0) / 5 + (post.repostCount ?? 0) * 2),
        velocity: 58,
        credibility: 20,
        relevance: 65,
      }];
    }),
  );
}

async function mastodon(): Promise<TrendItem[]> {
  const tags = await fetchJson<Array<{ name: string; url: string; history?: Array<{ uses: string; accounts: string }> }>>(
    "https://mastodon.social/api/v1/trends/tags?limit=30",
  );
  return tags.map((tag, index) => ({
    id: `mastodon-${tag.name.toLowerCase()}`,
    title: cleanSignal(tag.name.replace(/([a-z])([A-Z])/g, "$1 $2")),
    url: tag.url,
    channel: "mastodon" as const,
    capturedAt: new Date().toISOString(),
    engagement: Math.min(100, Number(tag.history?.[0]?.uses ?? 0) / 20),
    velocity: Math.max(35, 85 - index * 2),
    credibility: 20,
    relevance: 55,
  }));
}

async function youtube(): Promise<TrendItem[]> {
  if (!env.YOUTUBE_API_KEY) return [];
  const publishedAfter = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
  const response = await fetchJson<{
    items: Array<{ id: { videoId?: string }; snippet: { title: string; publishedAt: string } }>;
  }>(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&regionCode=US&maxResults=25&publishedAfter=${encodeURIComponent(publishedAfter)}&q=${encodeURIComponent("technology OR AI OR robotics OR space")}&key=${env.YOUTUBE_API_KEY}`,
  );
  return response.items.flatMap((item, index) => {
    if (!item.id.videoId) return [];
    return [{
      id: `youtube-${item.id.videoId}`,
      title: cleanSignal(item.snippet.title),
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      channel: "youtube" as const,
      capturedAt: new Date().toISOString(),
      engagement: Math.max(35, 90 - index * 2),
      velocity: Math.max(40, 88 - index * 2),
      credibility: 25,
      relevance: 70,
    }];
  });
}

export async function collectTrendSignals() {
  const adapters = [
    ["google-trends", googleTrends],
    ["google-news", googleNews],
    ["hacker-news", hackerNews],
    ["bluesky", bluesky],
    ["mastodon", mastodon],
    ["youtube", youtube],
  ] as const;

  const results = await Promise.allSettled(adapters.map(([, adapter]) => adapter()));
  const errors: Array<{ adapter: string; error: string }> = [];
  const items: TrendItem[] = [];

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      errors.push({
        adapter: adapters[index][0],
        error: result.reason instanceof Error ? result.reason.message : "Unknown adapter failure",
      });
    }
  });

  return { items, errors };
}
