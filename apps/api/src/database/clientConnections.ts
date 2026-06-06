import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type {
  ClientAccessStatus,
  ClientHeartbeatRequest,
} from "../../../shared/clientContracts.js";

interface ClientColumnRow extends RowDataPacket {
  columnName: string;
}

interface ClientIndexRow extends RowDataPacket {
  indexName: string;
}

interface ClientCredentialRow extends RowDataPacket {
  accessStatus: ClientAccessStatus;
  credentialHash: string | null;
  id: string;
}

interface EnrollmentTokenRow extends RowDataPacket {
  expiresAt: Date;
  id: string;
  usedAt: Date | null;
}

export interface ClientCredentialRecord {
  accessStatus: ClientAccessStatus;
  credentialHash: string | null;
  id: string;
}

export interface CreateClientEnrollmentTokenInput {
  createdByUserId: string;
  expiresAt: Date;
  id: string;
  tokenHash: string;
}

export interface RegisterClientInput {
  clientId: string;
  credentialHash: string;
  enrollmentTokenHash: string;
  name: string;
  softwareVersion: string | null;
}

export type RegisterClientResult =
  | {
      clientId: string;
      status: "created";
    }
  | {
      status: "invalid";
    };

export async function ensureClientConnectionSchema(
  pool: Pool,
  databaseName: string,
): Promise<void> {
  const columns = await getClientColumns(pool, databaseName);

  if (!columns.has("access_status")) {
    await pool.execute(
      "ALTER TABLE clients ADD COLUMN access_status ENUM('active', 'disabled') NOT NULL DEFAULT 'active' AFTER status",
    );
  }

  if (!columns.has("credential_hash")) {
    await pool.execute(
      "ALTER TABLE clients ADD COLUMN credential_hash CHAR(64) NULL AFTER access_status",
    );
  }

  if (!columns.has("software_version")) {
    await pool.execute(
      "ALTER TABLE clients ADD COLUMN software_version VARCHAR(64) NULL AFTER credential_hash",
    );
  }

  if (!columns.has("current_manifest_version")) {
    await pool.execute(
      "ALTER TABLE clients ADD COLUMN current_manifest_version INT UNSIGNED NULL AFTER current_manifest_id",
    );
  }

  if (!columns.has("last_sync_result")) {
    await pool.execute(
      "ALTER TABLE clients ADD COLUMN last_sync_result VARCHAR(255) NULL AFTER last_seen_at",
    );
  }

  const indexes = await getClientIndexes(pool, databaseName);

  if (!indexes.has("clients_credential_hash_unique")) {
    await pool.execute(
      "CREATE UNIQUE INDEX clients_credential_hash_unique ON clients (credential_hash)",
    );
  }

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS client_enrollment_tokens (
      id VARCHAR(64) PRIMARY KEY,
      token_hash CHAR(64) NOT NULL,
      created_by_user_id VARCHAR(64) NULL,
      expires_at TIMESTAMP NOT NULL,
      used_at TIMESTAMP NULL,
      used_by_client_id VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY client_enrollment_tokens_hash_unique (token_hash),
      INDEX client_enrollment_tokens_expires_at_index (expires_at),
      CONSTRAINT client_enrollment_tokens_created_by_user_id_fk
        FOREIGN KEY (created_by_user_id) REFERENCES admin_users (id)
        ON DELETE SET NULL,
      CONSTRAINT client_enrollment_tokens_used_by_client_id_fk
        FOREIGN KEY (used_by_client_id) REFERENCES clients (id)
        ON DELETE SET NULL
    )
  `);
}

export async function createClientEnrollmentToken(
  pool: Pool,
  input: CreateClientEnrollmentTokenInput,
): Promise<void> {
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO client_enrollment_tokens (
        id,
        token_hash,
        created_by_user_id,
        expires_at
      )
      VALUES (?, ?, ?, ?)
    `,
    [input.id, input.tokenHash, input.createdByUserId, input.expiresAt],
  );
}

export async function registerClientWithEnrollmentToken(
  pool: Pool,
  input: RegisterClientInput,
): Promise<RegisterClientResult> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const token = await findEnrollmentTokenForUpdate(connection, input.enrollmentTokenHash);

    if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now()) {
      await connection.rollback();
      return { status: "invalid" };
    }

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO clients (
          id,
          name,
          status,
          access_status,
          credential_hash,
          software_version,
          last_seen_at
        )
        VALUES (?, ?, 'online', 'active', ?, ?, NOW())
      `,
      [input.clientId, input.name, input.credentialHash, input.softwareVersion],
    );
    await connection.execute<ResultSetHeader>(
      `
        UPDATE client_enrollment_tokens
        SET
          used_at = NOW(),
          used_by_client_id = ?
        WHERE id = ?
          AND used_at IS NULL
      `,
      [input.clientId, token.id],
    );
    await connection.commit();

    return {
      clientId: input.clientId,
      status: "created",
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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

async function findEnrollmentTokenForUpdate(
  connection: PoolConnection,
  tokenHash: string,
): Promise<EnrollmentTokenRow | null> {
  const [rows] = await connection.execute<EnrollmentTokenRow[]>(
    `
      SELECT
        id,
        expires_at AS expiresAt,
        used_at AS usedAt
      FROM client_enrollment_tokens
      WHERE token_hash = ?
      LIMIT 1
      FOR UPDATE
    `,
    [tokenHash],
  );

  return rows[0] ?? null;
}

async function getClientColumns(pool: Pool, databaseName: string): Promise<Set<string>> {
  const [rows] = await pool.execute<ClientColumnRow[]>(
    `
      SELECT COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'clients'
    `,
    [databaseName],
  );

  return new Set(rows.map((row) => row.columnName));
}

async function getClientIndexes(pool: Pool, databaseName: string): Promise<Set<string>> {
  const [rows] = await pool.execute<ClientIndexRow[]>(
    `
      SELECT DISTINCT INDEX_NAME AS indexName
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'clients'
    `,
    [databaseName],
  );

  return new Set(rows.map((row) => row.indexName));
}
