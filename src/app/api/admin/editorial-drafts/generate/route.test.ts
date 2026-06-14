import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAdminAuthenticated: vi.fn(),
  isEditorialDraftBearerAuthorized: vi.fn(),
  isSameOriginRequest: vi.fn(),
  generateEditorialDraft: vi.fn(),
}));
const envState = vi.hoisted(() => ({ publishingEnabled: true }));

vi.mock("@/lib/admin-auth", () => ({
  isAdminAuthenticated: mocks.isAdminAuthenticated,
  isEditorialDraftBearerAuthorized: mocks.isEditorialDraftBearerAuthorized,
  isSameOriginRequest: mocks.isSameOriginRequest,
}));
vi.mock("@/lib/env", () => ({
  get publishingEnabled() {
    return envState.publishingEnabled;
  },
  siteRedirectUrl: (path: string) => new URL(path, "https://thetechholler.com"),
}));
vi.mock("@/lib/pipeline/editorial-queue", () => ({
  generateEditorialDraft: mocks.generateEditorialDraft,
}));

import { POST } from "./route";

function request() {
  return new Request(
    "https://thetechholler.com/api/admin/editorial-drafts/generate",
    { method: "POST", headers: { origin: "https://thetechholler.com" } },
  );
}

describe("on-demand AI publishing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.publishingEnabled = true;
    mocks.isEditorialDraftBearerAuthorized.mockReturnValue(false);
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isAdminAuthenticated.mockResolvedValue(true);
    mocks.generateEditorialDraft.mockResolvedValue({
      status: "published",
      article: { id: "article-1", slug: "new-story", title: "New Story" },
    });
  });

  it("runs the shared publishing pipeline for an authenticated dashboard request", async () => {
    const response = await POST(request());

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://thetechholler.com/admin?aiResult=published",
    );
    expect(mocks.generateEditorialDraft).toHaveBeenCalledTimes(1);
    expect(mocks.generateEditorialDraft).toHaveBeenCalledWith();
  });

  it("rejects an unauthorized request without running the AI pipeline", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    mocks.isAdminAuthenticated.mockResolvedValue(false);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });

  it("returns the published article to an authorized bearer client", async () => {
    mocks.isEditorialDraftBearerAuthorized.mockReturnValue(true);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        status: "published",
        article: expect.objectContaining({ slug: "new-story" }),
      }),
    );
  });

  it("blocks on-demand AI publishing while the kill switch is off", async () => {
    envState.publishingEnabled = false;

    const response = await POST(request());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      status: "paused",
      reason: "PUBLISHING_ENABLED is false",
    });
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });
});
