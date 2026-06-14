import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthorizedCron: vi.fn(),
  hasJobForSlot: vi.fn(),
  generateEditorialDraft: vi.fn(),
  easternDraftSlot: vi.fn(),
}));
const envState = vi.hoisted(() => ({ publishingEnabled: true }));

vi.mock("@/lib/env", () => ({
  env: { EDITORIAL_SCHEDULE_HOURS: "7" },
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
  easternDraftSlot: mocks.easternDraftSlot,
}));

import { POST } from "./route";

function request() {
  return new Request("https://thetechholler.com/api/cron/daily", { method: "POST" });
}

describe("daily editorial schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.publishingEnabled = true;
    mocks.isAuthorizedCron.mockReturnValue(true);
    mocks.easternDraftSlot.mockReturnValue({ hour: 7, slot: "2026-06-14-7" });
    mocks.hasJobForSlot.mockResolvedValue(false);
    mocks.generateEditorialDraft.mockResolvedValue({ status: "published" });
  });

  it("skips outside the configured Eastern hour without checking the queue", async () => {
    mocks.easternDraftSlot.mockReturnValue({ hour: 8, slot: "2026-06-14-8" });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ status: "skipped" }),
    );
    expect(mocks.generateEditorialDraft).not.toHaveBeenCalled();
  });

  it("runs independently when curated drafts are awaiting review", async () => {
    const response = await POST(request());

    expect(await response.json()).toEqual({ status: "published" });
    expect(mocks.generateEditorialDraft).toHaveBeenCalledWith({
      slot: "2026-06-14-7",
    });
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

  it("publishes one AI article for an allowed unattempted slot", async () => {
    const response = await POST(request());

    expect(await response.json()).toEqual({ status: "published" });
    expect(mocks.generateEditorialDraft).toHaveBeenCalledWith({
      slot: "2026-06-14-7",
    });
  });

  it("blocks scheduled AI publishing while the kill switch is off", async () => {
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
