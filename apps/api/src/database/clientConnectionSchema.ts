import type { Pool, RowDataPacket } from "mysql2/promise";

interface ClientColumnRow extends RowDataPacket {
  columnName: string;
}

interface ClientIndexRow extends RowDataPacket {
  indexName: string;
}

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
