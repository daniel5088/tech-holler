import { env } from "@/lib/env";

export type BlueskyPostInput = {
  title: string;
  dek: string;
  url: string;
  /** Absolute URL of an image to use as the link-card thumbnail (e.g. the OG image). */
  imageUrl?: string;
};

export type BlueskyPostResult = {
  posted: boolean;
  reason?: string;
  uri?: string;
};

// Bluesky rejects blobs larger than ~1MB; our OG cards are ~60KB.
const MAX_THUMB_BYTES = 976_560;

function service() {
  return (env.BLUESKY_SERVICE_URL || "https://bsky.social").replace(/\/$/, "");
}

async function uploadThumb(accessJwt: string, imageUrl: string) {
  const img = await fetch(imageUrl);
  if (!img.ok) return undefined;
  const bytes = new Uint8Array(await img.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_THUMB_BYTES) return undefined;
  const contentType = img.headers.get("content-type") || "image/png";
  const res = await fetch(`${service()}/xrpc/com.atproto.repo.uploadBlob`, {
    method: "POST",
    headers: { "Content-Type": contentType, Authorization: `Bearer ${accessJwt}` },
    body: bytes,
  });
  if (!res.ok) return undefined;
  const data = (await res.json()) as { blob?: unknown };
  return data.blob;
}

/**
 * Post an article to Bluesky as a rich external link card. Best-effort: never
 * throws and no-ops when credentials are not configured, so a social failure
 * can't break publishing.
 */
export async function postToBluesky(input: BlueskyPostInput): Promise<BlueskyPostResult> {
  if (!env.BLUESKY_IDENTIFIER || !env.BLUESKY_APP_PASSWORD) {
    return { posted: false, reason: "Bluesky not configured" };
  }
  try {
    const sessionRes = await fetch(`${service()}/xrpc/com.atproto.server.createSession`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: env.BLUESKY_IDENTIFIER,
        password: env.BLUESKY_APP_PASSWORD,
      }),
    });
    if (!sessionRes.ok) return { posted: false, reason: `createSession ${sessionRes.status}` };
    const session = (await sessionRes.json()) as { accessJwt?: string; did?: string };
    if (!session.accessJwt || !session.did) {
      return { posted: false, reason: "createSession returned no token" };
    }

    let thumb: unknown;
    if (input.imageUrl) {
      try {
        thumb = await uploadThumb(session.accessJwt, input.imageUrl);
      } catch {
        // A missing thumbnail must not block the post.
      }
    }

    // Bluesky post text is capped at 300 graphemes; titles are far shorter.
    const text = input.title.length > 280 ? `${input.title.slice(0, 279)}…` : input.title;
    const record = {
      $type: "app.bsky.feed.post",
      text,
      createdAt: new Date().toISOString(),
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: input.url,
          title: input.title.slice(0, 300),
          description: (input.dek || "").slice(0, 1000),
          ...(thumb ? { thumb } : {}),
        },
      },
    };

    const postRes = await fetch(`${service()}/xrpc/com.atproto.repo.createRecord`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.accessJwt}` },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record,
      }),
    });
    if (!postRes.ok) return { posted: false, reason: `createRecord ${postRes.status}` };
    const data = (await postRes.json()) as { uri?: string };
    return { posted: true, uri: data.uri };
  } catch (error) {
    return { posted: false, reason: error instanceof Error ? error.message : "post failed" };
  }
}
