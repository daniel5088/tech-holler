import { describe, expect, it } from "vitest";
import { isAllowedAdminOrigin } from "@/lib/admin-auth";
import { siteRedirectUrl } from "@/lib/env";

describe("admin public-origin handling", () => {
  it("builds redirects from the configured public site instead of an internal request URL", () => {
    expect(
      siteRedirectUrl("/admin", "https://thetechholler.com").toString(),
    ).toBe("https://thetechholler.com/admin");
  });

  it("accepts the configured public origin behind a reverse proxy", () => {
    expect(
      isAllowedAdminOrigin(
        "https://thetechholler.com",
        "https://thetechholler.com",
      ),
    ).toBe(true);
  });

  it("rejects a different origin and malformed input", () => {
    expect(
      isAllowedAdminOrigin(
        "https://attacker.example",
        "https://thetechholler.com",
      ),
    ).toBe(false);
    expect(isAllowedAdminOrigin("not a URL", "https://thetechholler.com")).toBe(false);
  });
});
