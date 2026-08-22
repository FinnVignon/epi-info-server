import { describe, expect, it } from "vitest";

import { readAssetStatusBody } from "../apps/api/src/routes/adminAssetRequestParsers.js";

describe("admin asset request validation", () => {
  it.each(["active", "archived"] as const)("accepts the %s asset status", (status) => {
    expect(readAssetStatusBody({ status })).toBe(status);
  });

  it("rejects missing or unsupported asset statuses", () => {
    expect(readAssetStatusBody({})).toBeNull();
    expect(readAssetStatusBody({ status: "deleted" as "active" })).toBeNull();
  });
});
