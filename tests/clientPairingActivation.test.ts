import type { Pool } from "mysql2/promise";
import { afterEach, describe, expect, it, vi } from "vitest";

import { activateClientPairing } from "../apps/api/src/database/clientPairingActivation.js";

describe("client pairing activation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("records an allowed pending poll without creating a client", async () => {
    const { connection, pool } = createDatabaseMock({
      approvedGroupId: null,
      approvedName: null,
      expiresAt: new Date(Date.now() + 60_000),
      id: "pairing-1",
      lastPolledAt: null,
      pollIntervalSeconds: 5,
      softwareVersion: "1.0.1",
      status: "pending",
    });

    await expect(activateClientPairing(pool, createActivationInput())).resolves.toMatchObject({
      pollIntervalSeconds: 5,
      status: "pending",
    });
    expect(connection.execute).toHaveBeenCalledTimes(2);
    expect(connection.commit).toHaveBeenCalledOnce();
  });

  it("slows clients that poll before the server interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { connection, pool } = createDatabaseMock({
      approvedGroupId: null,
      approvedName: null,
      expiresAt: new Date("2026-01-01T00:01:00.000Z"),
      id: "pairing-1",
      lastPolledAt: new Date("2025-12-31T23:59:58.000Z"),
      pollIntervalSeconds: 5,
      softwareVersion: null,
      status: "pending",
    });

    await expect(activateClientPairing(pool, createActivationInput())).resolves.toEqual({
      retryAfterSeconds: 3,
      status: "slow_down",
    });
    expect(connection.execute).toHaveBeenCalledOnce();
  });

  it("creates one permanent client and consumes an approved session atomically", async () => {
    const { connection, pool } = createDatabaseMock({
      approvedGroupId: null,
      approvedName: "Lobby screen",
      expiresAt: new Date(Date.now() + 60_000),
      id: "pairing-1",
      lastPolledAt: new Date(),
      pollIntervalSeconds: 5,
      softwareVersion: "1.0.1",
      status: "approved",
    });

    await expect(activateClientPairing(pool, createActivationInput())).resolves.toEqual({
      clientId: "client-1",
      status: "approved",
    });
    expect(connection.execute).toHaveBeenCalledTimes(3);
    expect(connection.execute.mock.calls[1]?.[0]).toContain("INSERT INTO clients");
    expect(connection.execute.mock.calls[2]?.[0]).toContain("status = 'consumed'");
    expect(connection.commit).toHaveBeenCalledOnce();
  });
});

function createActivationInput() {
  return {
    clientId: "client-1",
    credentialHash: "a".repeat(64),
    deviceCodeHash: "b".repeat(64),
  };
}

function createDatabaseMock(pairing: Record<string, unknown>) {
  const connection = {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    execute: vi
      .fn()
      .mockResolvedValueOnce([[pairing]])
      .mockResolvedValue([{ affectedRows: 1 }]),
    release: vi.fn(),
    rollback: vi.fn().mockResolvedValue(undefined),
  };
  const pool = {
    getConnection: vi.fn().mockResolvedValue(connection),
  } as unknown as Pool;

  return { connection, pool };
}
