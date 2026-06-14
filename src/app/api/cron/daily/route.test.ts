import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthorizedCron: vi.fn(),
  hasJobForSlot: vi.fn(),
  generateEditorialDraft: vi.fn(),
  easternCategorySlot: vi.fn(),
}));
const envState = vi.hoisted(() => ({ publishingEnabled: true }));

vi.mock("@/lib/env", () => ({
  get publishingEnabled() {
    return envState.publishingEnabled;
  },
}));
vi.mock("@/lib/pipeline/auth", () => ({
  isAuthorizedCron: mocks.isAuthorizedCron,
}));
vi.mock("@/lib/pipeline/repository", () => ({
  hasJobForSlot: mocks.hasJobForSlot,
}));
vi.mock("@/lib/pipeline/editorial-queue", () => ({
  generateEditorialDraft: mocks.generateEditorialDraft,
}));
vi.mock("@/lib/pipeline/schedule", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pipeline/schedule")>()),
  easternCategorySlot: mocks.easternCategorySlot,
}));

import { POST } from "./route";

function request(query = "") {
  return new Request(`https://thetechholler.com/api/cron/daily${query}`, {
    method: "POST",
  });
}

describe("daily category schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.publishingEnabled = true;
    mocks.isAuthorizedCron.mockReturnValue(true);
    mocks.easternCategorySlot.mockReturnValue({
      hour: 13,
      category: "space-science",
      slot: "2026-06-14-13-space-science",
    });
    mocks.hasJobForSlot.mockResolvedValue(false);
    mocks.generateEditorialDraft.mockResolvedValue({ status: "published" });
  });

  it("skips outside a category publishing hour without checking a slot", async () => {
    mocks.easternCategorySlot.mockReturnValue({
      hour: 14,
      category: null,
      slot: null,
    });

    const response = await POST(request());

    expect(await response.json()).toEqual({
      status: "skipped",
      reason: "Outside an Eastern category publishing window",
    });
    expect(mocks.hasJobForSlot).not.toHaveBeenCalled();
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });

  it("passes the scheduled category and category-specific slot to the pipeline", async () => {
    const response = await POST(request());

    expect(await response.json()).toEqual({ status: "published" });
    expect(mocks.hasJobForSlot).toHaveBeenCalledWith(
      "editorial-draft",
      "2026-06-14-13-space-science",
    );
    expect(mocks.generateEditorialDraft).toHaveBeenCalledWith({
      slot: "2026-06-14-13-space-science",
      category: "space-science",
    });
  });

  it("skips only the previously attempted category slot", async () => {
    mocks.hasJobForSlot.mockResolvedValue(true);

    const response = await POST(request());

    expect(await response.json()).toEqual({
      status: "skipped",
      reason: "Editorial category slot already attempted",
    });
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });

  it("runs a forced targeted category without a scheduled slot", async () => {
    const response = await POST(request("?force=true&category=futurecasting"));

    expect(await response.json()).toEqual({ status: "published" });
    expect(mocks.hasJobForSlot).not.toHaveBeenCalled();
    expect(mocks.generateEditorialDraft).toHaveBeenCalledWith({
      category: "futurecasting",
    });
  });

  it("runs a forced general pipeline when no category is supplied", async () => {
    const response = await POST(request("?force=true"));

    expect(await response.json()).toEqual({ status: "published" });
    expect(mocks.generateEditorialDraft).toHaveBeenCalledWith({});
  });

  it("rejects an invalid forced category", async () => {
    const response = await POST(request("?force=true&category=not-a-section"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid category" });
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });

  it("blocks every scheduled category while the kill switch is off", async () => {
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
