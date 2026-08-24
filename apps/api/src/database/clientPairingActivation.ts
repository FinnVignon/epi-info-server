import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

interface PairingActivationRow extends RowDataPacket {
  approvedGroupId: string | null;
  approvedName: string | null;
  expiresAt: Date;
  id: string;
  lastPolledAt: Date | null;
  pollIntervalSeconds: number;
  softwareVersion: string | null;
  status: "approved" | "consumed" | "pending" | "rejected";
}

export interface ActivateClientPairingInput {
  clientId: string;
  credentialHash: string;
  deviceCodeHash: string;
}

export type ActivateClientPairingResult =
  | { expiresAt: Date; pollIntervalSeconds: number; status: "pending" }
  | { retryAfterSeconds: number; status: "slow_down" }
  | { clientId: string; status: "approved" }
  | { status: "consumed" | "expired" | "invalid" | "rejected" };

export async function activateClientPairing(
  pool: Pool,
  input: ActivateClientPairingInput,
): Promise<ActivateClientPairingResult> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const pairing = await findPairingForUpdate(connection, input.deviceCodeHash);

    if (!pairing) {
      await connection.rollback();
      return { status: "invalid" };
    }

    const result = await resolvePairing(connection, pairing, input);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function resolvePairing(
  connection: PoolConnection,
  pairing: PairingActivationRow,
  input: ActivateClientPairingInput,
): Promise<ActivateClientPairingResult> {
  if (pairing.expiresAt.getTime() <= Date.now()) {
    return { status: "expired" };
  }

  if (pairing.status !== "pending" && pairing.status !== "approved") {
    return { status: pairing.status };
  }

  if (pairing.status === "pending") {
    const retryAfterSeconds = secondsUntilNextPoll(pairing);

    if (retryAfterSeconds > 0) {
      return { retryAfterSeconds, status: "slow_down" };
    }

    await connection.execute<ResultSetHeader>(
      "UPDATE client_pairing_sessions SET last_polled_at = NOW(6) WHERE id = ?",
      [pairing.id],
    );
    return {
      expiresAt: pairing.expiresAt,
      pollIntervalSeconds: pairing.pollIntervalSeconds,
      status: "pending",
    };
  }

  if (!pairing.approvedName) {
    throw new Error("Approved client pairing is missing a client name");
  }

  await createPairedClient(connection, pairing, input);
  await addPairedClientToGroup(connection, pairing.approvedGroupId, input.clientId);
  await markPairingConsumed(connection, pairing.id, input.clientId);

  return { clientId: input.clientId, status: "approved" };
}

async function findPairingForUpdate(
  connection: PoolConnection,
  deviceCodeHash: string,
): Promise<PairingActivationRow | null> {
  const [rows] = await connection.execute<PairingActivationRow[]>(
    `
      SELECT
        id,
        status,
        poll_interval_seconds AS pollIntervalSeconds,
        last_polled_at AS lastPolledAt,
        approved_name AS approvedName,
        approved_group_id AS approvedGroupId,
        software_version AS softwareVersion,
        expires_at AS expiresAt
      FROM client_pairing_sessions
      WHERE device_code_hash = ?
      LIMIT 1
      FOR UPDATE
    `,
    [deviceCodeHash],
  );

  return rows[0] ?? null;
}

async function createPairedClient(
  connection: PoolConnection,
  pairing: PairingActivationRow,
  input: ActivateClientPairingInput,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO clients (
        id, name, status, access_status, credential_hash, software_version, last_seen_at
      )
      VALUES (?, ?, 'online', 'active', ?, ?, NOW())
    `,
    [input.clientId, pairing.approvedName, input.credentialHash, pairing.softwareVersion],
  );
}

async function addPairedClientToGroup(
  connection: PoolConnection,
  groupId: string | null,
  clientId: string,
): Promise<void> {
  if (!groupId) {
    return;
  }

  await connection.execute<ResultSetHeader>(
    "INSERT INTO client_groups (client_id, group_id) VALUES (?, ?)",
    [clientId, groupId],
  );
  await connection.execute<ResultSetHeader>(
    "UPDATE display_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [groupId],
  );
}

async function markPairingConsumed(
  connection: PoolConnection,
  pairingId: string,
  clientId: string,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      UPDATE client_pairing_sessions
      SET status = 'consumed', consumed_at = NOW(6), used_by_client_id = ?
      WHERE id = ? AND status = 'approved'
    `,
    [clientId, pairingId],
  );
}

function secondsUntilNextPoll(pairing: PairingActivationRow): number {
  if (!pairing.lastPolledAt) {
    return 0;
  }

  const nextPollAt = pairing.lastPolledAt.getTime() + pairing.pollIntervalSeconds * 1000;

  return Math.max(0, Math.ceil((nextPollAt - Date.now()) / 1000));
}
