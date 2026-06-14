import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthorizedCron: vi.fn(),
  hasJobForSlot: vi.fn(),
  hasPendingEditorialDraft: vi.fn(),
  generateEditorialDraft: vi.fn(),
  easternDraftSlot: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: { EDITORIAL_SCHEDULE_HOURS: "7" },
  publishingEnabled: true,
}));
vi.mock("@/lib/pipeline/auth", () => ({
  isAuthorizedCron: mocks.isAuthorizedCron,
}));
vi.mock("@/lib/pipeline/repository", () => ({
  hasJobForSlot: mocks.hasJobForSlot,
  hasPendingEditorialDraft: mocks.hasPendingEditorialDraft,
}));
vi.mock("@/lib/pipeline/editorial-queue", () => ({
  generateEditorialDraft: mocks.generateEditorialDraft,
}));
vi.mock("@/lib/pipeline/schedule", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pipeline/schedule")>()),
  easternDraftSlot: mocks.easternDraftSlot,
}));

import { POST } from "./route";

function request() {
  return new Request("https://thetechholler.com/api/cron/daily", { method: "POST" });
}

describe("daily editorial schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthorizedCron.mockReturnValue(true);
    mocks.easternDraftSlot.mockReturnValue({ hour: 7, slot: "2026-06-14-7" });
    mocks.hasPendingEditorialDraft.mockResolvedValue(false);
    mocks.hasJobForSlot.mockResolvedValue(false);
    mocks.generateEditorialDraft.mockResolvedValue({ status: "completed" });
  });

  it("skips outside the configured Eastern hour without checking the queue", async () => {
    mocks.easternDraftSlot.mockReturnValue({ hour: 8, slot: "2026-06-14-8" });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ status: "skipped" }),
    );
    expect(mocks.hasPendingEditorialDraft).not.toHaveBeenCalled();
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });

  it("skips when a private draft already awaits review", async () => {
    mocks.hasPendingEditorialDraft.mockResolvedValue(true);

    const response = await POST(request());

    expect(await response.json()).toEqual({
      status: "skipped",
      reason: "A private draft is already awaiting review",
    });
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });

  it("skips a schedule slot that was already attempted", async () => {
    mocks.hasJobForSlot.mockResolvedValue(true);

    const response = await POST(request());

    expect(await response.json()).toEqual({
      status: "skipped",
      reason: "Editorial draft slot already attempted",
    });
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });

  it("generates one private draft for an allowed empty slot", async () => {
    const response = await POST(request());

    expect(await response.json()).toEqual({ status: "completed" });
    expect(mocks.generateEditorialDraft).toHaveBeenCalledWith({
      slot: "2026-06-14-7",
    });
  });
});
