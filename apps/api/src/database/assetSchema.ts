import type { Pool, RowDataPacket } from "mysql2/promise";

interface AssetColumnRow extends RowDataPacket {
  columnName: string;
}

export async function ensureAssetSchema(pool: Pool, databaseName: string): Promise<void> {
  const columns = await getAssetColumns(pool, databaseName);

  if (!columns.has("display_name")) {
    await pool.execute("ALTER TABLE assets ADD COLUMN display_name VARCHAR(255) NULL AFTER id");
    await pool.execute(
      "UPDATE assets SET display_name = original_filename WHERE display_name IS NULL OR display_name = ''",
    );
    await pool.execute("ALTER TABLE assets MODIFY display_name VARCHAR(255) NOT NULL");
  }

  if (!columns.has("status")) {
    await pool.execute(
      "ALTER TABLE assets ADD COLUMN status ENUM('active', 'archived') NOT NULL DEFAULT 'active' AFTER public_url",
    );
  }

  if (!columns.has("uploaded_by_user_id")) {
    await pool.execute(
      "ALTER TABLE assets ADD COLUMN uploaded_by_user_id VARCHAR(64) NULL AFTER status",
    );
  }

  if (!columns.has("archived_at")) {
    await pool.execute(
      "ALTER TABLE assets ADD COLUMN archived_at TIMESTAMP NULL AFTER uploaded_by_user_id",
    );
  }

  await ensureAssetArchivedAtIndex(pool, databaseName);
}

async function getAssetColumns(pool: Pool, databaseName: string): Promise<Set<string>> {
  const [rows] = await pool.execute<AssetColumnRow[]>(
    `
      SELECT COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'assets'
    `,
    [databaseName],
  );

  return new Set(rows.map((row) => row.columnName));
}

async function ensureAssetArchivedAtIndex(pool: Pool, databaseName: string): Promise<void> {
  const [rows] = await pool.execute<RowDataPacket[]>(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'assets'
        AND INDEX_NAME = 'assets_archived_at_index'
      LIMIT 1
    `,
    [databaseName],
  );

  if (!rows[0]) {
    await pool.execute("CREATE INDEX assets_archived_at_index ON assets (archived_at)");
  }
}
