import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isSameOriginRequest: vi.fn(),
  getServiceSupabase: vi.fn(),
  cookiesGet: vi.fn(),
  headersGet: vi.fn(),
  randomUUID: vi.fn(),
  engagementConfigured: true,
}));

vi.mock("@/lib/admin-auth", () => ({
  isSameOriginRequest: mocks.isSameOriginRequest,
}));
vi.mock("@/lib/supabase", () => ({
  getServiceSupabase: mocks.getServiceSupabase,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookiesGet }),
  headers: async () => ({ get: mocks.headersGet }),
}));
vi.mock("node:crypto", () => ({ randomUUID: mocks.randomUUID }));
vi.mock("@/lib/reader-engagement", () => ({
  TH_VID_COOKIE: "th_vid",
  TH_VID_MAX_AGE: 31536000,
  get engagementConfigured() {
    return mocks.engagementConfigured;
  },
  visitorHash: (vid: string) => `vhash:${vid}`,
  ipHash: (xff: string | null) => (xff ? `iphash:${xff}` : null),
}));

import { POST } from "./route";

type SupabaseStub = {
  rpc: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
};

function buildSupabase(overrides?: Partial<SupabaseStub>) {
  const maybeSingle =
    overrides?.maybeSingle ??
    vi.fn().mockResolvedValue({ data: { id: "article-1" }, error: null });
  const rpc =
    overrides?.rpc ??
    vi.fn().mockResolvedValue({ data: [{ like_count: 5, liked: true }], error: null });

  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  return {
    from: vi.fn().mockReturnValue(builder),
    rpc,
  };
}

function request(headers: Record<string, string> = { origin: "https://thetechholler.com" }) {
  return new Request("https://thetechholler.com/api/articles/some-slug/like", {
    method: "POST",
    headers,
  });
}

const params = Promise.resolve({ slug: "some-slug" });

describe("article like route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.engagementConfigured = true;
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.cookiesGet.mockReturnValue({ value: "device-uuid" });
    mocks.headersGet.mockReturnValue("203.0.113.4");
    mocks.randomUUID.mockReturnValue("minted-uuid");
    mocks.getServiceSupabase.mockReturnValue(buildSupabase());
  });

  it("rejects cross-origin requests with 403", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    const response = await POST(request({}), { params });
    expect(response.status).toBe(403);
    expect(mocks.getServiceSupabase).not.toHaveBeenCalled();
  });

  it("returns 503 when engagement is not configured", async () => {
    mocks.engagementConfigured = false;
    const response = await POST(request(), { params });
    expect(response.status).toBe(503);
  });

  it("toggles the like and returns the reconciled count", async () => {
    const supabase = buildSupabase();
    mocks.getServiceSupabase.mockReturnValue(supabase);

    const response = await POST(request(), { params });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ likeCount: 5, liked: true });
    expect(supabase.rpc).toHaveBeenCalledWith("toggle_article_like", {
      p_article_id: "article-1",
      p_visitor_hash: "vhash:device-uuid",
      p_ip_hash: "iphash:203.0.113.4",
    });
    // Existing cookie present → no new th_vid issued.
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("issues a th_vid cookie when the device has none", async () => {
    mocks.cookiesGet.mockReturnValue(undefined);
    const supabase = buildSupabase();
    mocks.getServiceSupabase.mockReturnValue(supabase);

    const response = await POST(request(), { params });

    expect(response.status).toBe(200);
    expect(mocks.randomUUID).toHaveBeenCalled();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "toggle_article_like",
      expect.objectContaining({ p_visitor_hash: "vhash:minted-uuid" }),
    );
    const setCookie = response.headers.get("set-cookie");
    expect(setCookie).toContain("th_vid=minted-uuid");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie?.toLowerCase()).toContain("samesite=lax");
  });

  it("returns 404 when the slug resolves to no published article", async () => {
    mocks.getServiceSupabase.mockReturnValue(
      buildSupabase({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
    );
    const response = await POST(request(), { params });
    expect(response.status).toBe(404);
  });

  it("maps the RPC rate-limit error to 429", async () => {
    mocks.getServiceSupabase.mockReturnValue(
      buildSupabase({
        rpc: vi.fn().mockResolvedValue({ data: null, error: { code: "23514" } }),
      }),
    );
    const response = await POST(request(), { params });
    expect(response.status).toBe(429);
  });
});
