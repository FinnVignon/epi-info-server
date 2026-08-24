import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type {
  AdminClientPairing,
  ClientPairingGroupOption,
} from "../../../shared/clientPairingContracts.js";

interface PairingRow extends RowDataPacket {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  requestedName: string;
  softwareVersion: string | null;
}

interface PairingGroupRow extends RowDataPacket {
  id: string;
  name: string;
}

export interface CreateClientPairingSessionInput {
  deviceCodeHash: string;
  expiresAt: Date;
  id: string;
  pollIntervalSeconds: number;
  requestedName: string;
  softwareVersion: string | null;
  userCodeHash: string;
}

export async function createClientPairingSession(
  pool: Pool,
  input: CreateClientPairingSessionInput,
): Promise<void> {
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO client_pairing_sessions (
        id,
        user_code_hash,
        device_code_hash,
        requested_name,
        software_version,
        poll_interval_seconds,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.userCodeHash,
      input.deviceCodeHash,
      input.requestedName,
      input.softwareVersion,
      input.pollIntervalSeconds,
      input.expiresAt,
    ],
  );
}

export async function findPendingClientPairingByUserCode(
  pool: Pool,
  userCodeHash: string,
): Promise<AdminClientPairing | null> {
  const [rows] = await pool.execute<PairingRow[]>(
    `
      SELECT
        id,
        requested_name AS requestedName,
        software_version AS softwareVersion,
        expires_at AS expiresAt,
        created_at AS createdAt
      FROM client_pairing_sessions
      WHERE user_code_hash = ?
        AND status = 'pending'
        AND expires_at > NOW(6)
      LIMIT 1
    `,
    [userCodeHash],
  );

  return rows[0] ? mapPairing(rows[0]) : null;
}

export async function listClientPairingGroupOptions(
  pool: Pool,
): Promise<ClientPairingGroupOption[]> {
  const [rows] = await pool.execute<PairingGroupRow[]>(
    "SELECT id, name FROM display_groups ORDER BY name",
  );

  return rows.map((row) => ({ id: row.id, name: row.name }));
}

function mapPairing(row: PairingRow): AdminClientPairing {
  return {
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    id: row.id,
    requestedName: row.requestedName,
    softwareVersion: row.softwareVersion,
  };
}
