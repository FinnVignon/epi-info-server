import { describe, expect, it } from "vitest";

import {
  createClientPairingDeviceCode,
  createClientPairingUserCode,
  normalizeClientPairingUserCode,
} from "../apps/api/src/auth/clientPairingCodes.js";
import {
  readCreatePairingBody,
  readPairingApprovalBody,
  readPairingDeviceCode,
  readPairingUserCode,
} from "../apps/api/src/routes/clientPairingRequestParsers.js";

describe("client pairing codes", () => {
  it("creates readable eight-character user codes without ambiguous characters", () => {
    for (let index = 0; index < 100; index += 1) {
      const code = createClientPairingUserCode();

      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
      expect(normalizeClientPairingUserCode(code.toLowerCase())).toBe(code.replace("-", ""));
    }
  });

  it("creates high-entropy private device codes", () => {
    const first = createClientPairingDeviceCode();
    const second = createClientPairingDeviceCode();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("rejects ambiguous and malformed user codes", () => {
    expect(normalizeClientPairingUserCode("ABCI-2345")).toBeNull();
    expect(normalizeClientPairingUserCode("ABC-2345")).toBeNull();
    expect(normalizeClientPairingUserCode("ABCD-1234")).toBeNull();
  });
});

describe("client pairing request parsing", () => {
  it("normalizes valid creation and approval requests", () => {
    expect(readCreatePairingBody({ name: "  Lobby screen  ", softwareVersion: " 1.0.1 " })).toEqual(
      {
        name: "Lobby screen",
        softwareVersion: "1.0.1",
      },
    );
    expect(readPairingApprovalBody({ groupId: null, name: " Lobby " })).toEqual({
      groupId: null,
      name: "Lobby",
    });
  });

  it("rejects invalid public values before database access", () => {
    expect(readCreatePairingBody({ name: "x" })).toBeTypeOf("string");
    expect(readPairingDeviceCode({ deviceCode: "short" })).toBeNull();
    expect(readPairingUserCode({ userCode: "ABCD-10IO" })).toBeNull();
    expect(readPairingApprovalBody({ groupId: "", name: "Lobby" })).toBe("Group id is invalid");
  });
});
