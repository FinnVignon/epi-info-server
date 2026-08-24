import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type {
  ClientAccessStatus,
  ClientHeartbeatRequest,
} from "../../../shared/clientContracts.js";

interface ClientCredentialRow extends RowDataPacket {
  accessStatus: ClientAccessStatus;
  credentialHash: string | null;
  id: string;
}

export interface ClientCredentialRecord {
  accessStatus: ClientAccessStatus;
  credentialHash: string | null;
  id: string;
}

export async function findClientCredentialById(
  pool: Pool,
  clientId: string,
): Promise<ClientCredentialRecord | null> {
  const [rows] = await pool.execute<ClientCredentialRow[]>(
    `
      SELECT
        id,
        access_status AS accessStatus,
        credential_hash AS credentialHash
      FROM clients
      WHERE id = ?
      LIMIT 1
    `,
    [clientId],
  );
  const client = rows[0];

  return client
    ? {
        accessStatus: client.accessStatus,
        credentialHash: client.credentialHash,
        id: client.id,
      }
    : null;
}

export async function recordClientHeartbeat(
  pool: Pool,
  clientId: string,
  heartbeat: ClientHeartbeatRequest,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      UPDATE clients
      SET
        status = 'online',
        software_version = CASE WHEN ? THEN ? ELSE software_version END,
        current_manifest_id = CASE WHEN ? THEN ? ELSE current_manifest_id END,
        current_manifest_version = CASE WHEN ? THEN ? ELSE current_manifest_version END,
        last_seen_at = NOW(),
        last_sync_result = CASE WHEN ? THEN ? ELSE last_sync_result END,
        last_error = CASE WHEN ? THEN ? ELSE last_error END
      WHERE id = ?
        AND access_status = 'active'
    `,
    [
      heartbeat.softwareVersion !== undefined,
      heartbeat.softwareVersion ?? null,
      heartbeat.currentManifestId !== undefined,
      heartbeat.currentManifestId ?? null,
      heartbeat.currentManifestVersion !== undefined,
      heartbeat.currentManifestVersion ?? null,
      heartbeat.lastSyncResult !== undefined,
      heartbeat.lastSyncResult ?? null,
      heartbeat.lastError !== undefined,
      heartbeat.lastError ?? null,
      clientId,
    ],
  );

  return result.affectedRows > 0;
}
