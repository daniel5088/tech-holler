import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAdminAuthenticated: vi.fn(),
  isEditorialDraftBearerAuthorized: vi.fn(),
  isSameOriginRequest: vi.fn(),
  publishEditorialDraft: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/admin-auth", () => ({
  isAdminAuthenticated: mocks.isAdminAuthenticated,
  isEditorialDraftBearerAuthorized: mocks.isEditorialDraftBearerAuthorized,
  isSameOriginRequest: mocks.isSameOriginRequest,
}));
vi.mock("@/lib/env", () => ({
  siteRedirectUrl: (path: string) => new URL(path, "https://thetechholler.com"),
}));
vi.mock("@/lib/pipeline/repository", () => ({
  publishEditorialDraft: mocks.publishEditorialDraft,
}));

import { POST } from "./route";

function request() {
  return new Request(
    "https://thetechholler.com/api/admin/editorial-drafts/draft-2/publish",
    { method: "POST", headers: { origin: "https://thetechholler.com" } },
  );
}

describe("manual curated draft publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEditorialDraftBearerAuthorized.mockReturnValue(false);
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isAdminAuthenticated.mockResolvedValue(true);
    mocks.publishEditorialDraft.mockResolvedValue({
      id: "draft-2",
      slug: "curated-story",
      title: "Curated Story",
      category: "ai-robotics",
    });
  });

  it("publishes only the curated draft selected by the authenticated editor", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "draft-2" }),
    });

    expect(mocks.publishEditorialDraft).toHaveBeenCalledTimes(1);
    expect(mocks.publishEditorialDraft).toHaveBeenCalledWith("draft-2");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://thetechholler.com/article/curated-story",
    );
  });

  it("rejects unauthorized publication without selecting a draft", async () => {
    mocks.isSameOriginRequest.mockReturnValue(false);
    mocks.isAdminAuthenticated.mockResolvedValue(false);

    const response = await POST(request(), {
      params: Promise.resolve({ id: "draft-2" }),
    });

    expect(response.status).toBe(401);
    expect(mocks.publishEditorialDraft).not.toHaveBeenCalled();
  });
});
