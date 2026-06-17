import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  env: {
    BLUESKY_IDENTIFIER: "holler.bsky.social",
    BLUESKY_APP_PASSWORD: "app-pass-1234",
    BLUESKY_SERVICE_URL: "https://bsky.social",
  } as Record<string, string | undefined>,
}));
vi.mock("@/lib/env", () => mockEnv);

import { postToBluesky } from "./bluesky";

const input = {
  title: "Talk Around Town: A Specific Technology Event Is Underway",
  dek: "A company says it did a thing, but independent confirmation has not yet arrived.",
  url: "https://thetechholler.com/article/a-specific-event",
  imageUrl: "https://thetechholler.com/article/a-specific-event/opengraph-image",
};

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body, arrayBuffer: async () => new ArrayBuffer(0), headers: new Map() } as unknown as Response;
}

beforeEach(() => {
  mockEnv.env.BLUESKY_IDENTIFIER = "holler.bsky.social";
  mockEnv.env.BLUESKY_APP_PASSWORD = "app-pass-1234";
});
afterEach(() => vi.restoreAllMocks());

describe("postToBluesky", () => {
  it("no-ops when credentials are absent", async () => {
    mockEnv.env.BLUESKY_APP_PASSWORD = undefined;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await postToBluesky(input);

    expect(result.posted).toBe(false);
    expect(result.reason).toBe("Bluesky not configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("creates a session, uploads the thumbnail, and posts an external card", async () => {
    const calls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const u = String(url);
      calls.push(u);
      if (u.endsWith("createSession")) return jsonResponse({ accessJwt: "jwt-abc", did: "did:plc:xyz" });
      if (u.endsWith("article/a-specific-event/opengraph-image")) {
        return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer, headers: new Map([["content-type", "image/png"]]), json: async () => ({}) } as unknown as Response;
      }
      if (u.endsWith("uploadBlob")) return jsonResponse({ blob: { $type: "blob", ref: "r" } });
      if (u.endsWith("createRecord")) {
        const body = JSON.parse(String(init?.body));
        expect(body.collection).toBe("app.bsky.feed.post");
        expect(body.record.embed.$type).toBe("app.bsky.embed.external");
        expect(body.record.embed.external.uri).toBe(input.url);
        expect(body.record.embed.external.thumb).toBeTruthy();
        return jsonResponse({ uri: "at://did:plc:xyz/app.bsky.feed.post/123" });
      }
      throw new Error("unexpected fetch: " + u);
    });

    const result = await postToBluesky(input);

    expect(result.posted).toBe(true);
    expect(result.uri).toContain("app.bsky.feed.post");
    expect(calls.some((c) => c.endsWith("createSession"))).toBe(true);
    expect(calls.some((c) => c.endsWith("createRecord"))).toBe(true);
  });

  it("returns a reason and does not throw when the session fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ error: "Unauthorized" }, false, 401));

    const result = await postToBluesky(input);

    expect(result.posted).toBe(false);
    expect(result.reason).toContain("401");
  });

  it("still posts without a thumbnail when the image upload fails", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith("createSession")) return jsonResponse({ accessJwt: "jwt", did: "did:plc:x" });
      if (u.includes("opengraph-image")) return jsonResponse({}, false, 500);
      if (u.endsWith("createRecord")) return jsonResponse({ uri: "at://x/app.bsky.feed.post/9" });
      throw new Error("unexpected: " + u);
    });

    const result = await postToBluesky(input);

    expect(result.posted).toBe(true);
  });
});
