import type { Pool, RowDataPacket } from "mysql2/promise";

interface TimestampPrecisionRow extends RowDataPacket {
  datetimePrecision: number | null;
}

interface ColumnExistsRow extends RowDataPacket {
  columnName: string;
}

export async function ensureAssignmentSchema(pool: Pool, databaseName: string): Promise<void> {
  const [rows] = await pool.execute<TimestampPrecisionRow[]>(
    `
      SELECT DATETIME_PRECISION AS datetimePrecision
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'assignments'
        AND COLUMN_NAME = 'updated_at'
      LIMIT 1
    `,
    [databaseName],
  );

  if (!rows[0] || Number(rows[0].datetimePrecision ?? 0) === 6) {
    return;
  }

  await pool.execute(`
    ALTER TABLE assignments
      MODIFY COLUMN created_at
        TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      MODIFY COLUMN updated_at
        TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6)
  `);
}

export async function ensureAssignmentContentSchema(
  pool: Pool,
  databaseName: string,
): Promise<void> {
  await pool.execute(`
    ALTER TABLE manifest_items
      MODIFY COLUMN type ENUM('image', 'video', 'text', 'webpage', 'live_web_link') NOT NULL
  `);

  const [refreshRows] = await pool.execute<ColumnExistsRow[]>(
    `
      SELECT COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'manifest_items'
        AND COLUMN_NAME = 'refresh_seconds'
      LIMIT 1
    `,
    [databaseName],
  );

  if (!refreshRows[0]) {
    await pool.execute(`
      ALTER TABLE manifest_items
        ADD COLUMN refresh_seconds INT UNSIGNED NULL AFTER url
    `);
  }

  await pool.execute(`
    UPDATE manifest_items
    SET
      type = 'live_web_link',
      refresh_seconds = COALESCE(refresh_seconds, 60)
    WHERE type = 'webpage'
  `);

  await pool.execute(`
    ALTER TABLE manifest_items
      MODIFY COLUMN type ENUM('image', 'video', 'text', 'live_web_link') NOT NULL
  `);
}
