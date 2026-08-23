import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";

import {
  adminPasswordHashNeedsUpgrade,
  hashAdminPassword,
  readAdminPasswordValidationError,
  verifyAdminPassword,
} from "../apps/api/src/auth/passwords.js";
import {
  readBootstrapBody,
  readLoginBody,
} from "../apps/api/src/routes/adminAuthRequestParsers.js";

describe("admin password validation", () => {
  it("accepts a normal strong password", () => {
    expect(readAdminPasswordValidationError("testing12345")).toBeNull();
  });

  it("rejects short passwords", () => {
    expect(readAdminPasswordValidationError("short123")).toBe(
      "Password must be at least 10 characters",
    );
  });

  it("rejects passwords that bcrypt would truncate", () => {
    const password = "😀".repeat(19);

    expect(Buffer.byteLength(password, "utf8")).toBeGreaterThan(72);
    expect(readAdminPasswordValidationError(password)).toBe(
      "Password must not exceed 72 bytes when encoded as UTF-8",
    );
  });

  it("enforces password limits when bootstrapping", () => {
    expect(
      readBootstrapBody({
        displayName: "Administrator",
        email: "admin@example.com",
        password: "😀".repeat(19),
      }),
    ).toBe("Password must not exceed 72 bytes when encoded as UTF-8");
  });

  it("allows existing long-password accounts to attempt login", () => {
    const password = "😀".repeat(19);

    expect(readLoginBody({ email: "ADMIN@example.com", password })).toEqual({
      email: "admin@example.com",
      password,
    });
  });

  it("distinguishes passwords that only differ after bcrypt's input boundary", async () => {
    const password = `${"a".repeat(72)}-first`;
    const passwordHash = await hashAdminPassword(password, { bcryptRounds: 4 });

    await expect(verifyAdminPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyAdminPassword(`${"a".repeat(72)}-second`, passwordHash)).resolves.toBe(
      false,
    );
    expect(adminPasswordHashNeedsUpgrade(passwordHash, 4)).toBe(false);
  });

  it("recognizes legacy bcrypt hashes for transparent login upgrades", async () => {
    const legacyHash = await bcrypt.hash("testing12345", 4);

    await expect(verifyAdminPassword("testing12345", legacyHash)).resolves.toBe(true);
    expect(adminPasswordHashNeedsUpgrade(legacyHash, 4)).toBe(true);
  });
});
