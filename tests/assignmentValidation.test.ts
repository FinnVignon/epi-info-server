import { describe, expect, it } from "vitest";

import { readAssignmentBody } from "../apps/api/src/routes/adminAssignmentRouteUtils.js";

describe("display assignment validation", () => {
  it("accepts an asset assignment", () => {
    expect(readAssignmentBody({ assetId: " asset-1 ", fit: "cover" })).toEqual({
      assetId: "asset-1",
      contentType: "asset",
      fit: "cover",
    });
  });

  it("accepts and normalizes an HTTPS live link", () => {
    expect(
      readAssignmentBody({
        contentType: "live_web_link",
        refreshSeconds: 60,
        url: "https://example.com/status",
      }),
    ).toEqual({
      contentType: "live_web_link",
      refreshSeconds: 60,
      url: "https://example.com/status",
    });
  });

  it.each(["javascript:alert(1)", "file:///etc/passwd", "not a URL"])(
    "rejects unsafe live-link URL %s",
    (url) => {
      expect(readAssignmentBody({ contentType: "live_web_link", refreshSeconds: 60, url })).toBe(
        "Web link URL must use http or https",
      );
    },
  );

  it.each([0, 86401, 1.5, "60"])("rejects invalid refresh rate %s", (refreshSeconds) => {
    expect(
      readAssignmentBody({
        contentType: "live_web_link",
        refreshSeconds,
        url: "https://example.com",
      }),
    ).toBe("Refresh rate must be between 1 and 86400 seconds");
  });
});
