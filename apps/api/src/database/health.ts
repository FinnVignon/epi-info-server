import { Pool, RowDataPacket } from "mysql2/promise";

export const DATABASE_TABLES = [
  "admin_users",
  "admin_permissions",
  "admin_sessions",
  "clients",
  "client_enrollment_tokens",
  "display_groups",
  "client_groups",
  "assets",
  "manifests",
  "manifest_items",
  "assignments",
] as const;

export type DatabaseHealthStatus = "ok" | "schema_incomplete" | "unavailable";

export interface DatabaseHealth {
  error?: string;
  expectedTables: readonly string[];
  missingTables: string[];
  status: DatabaseHealthStatus;
}

interface TableRow extends RowDataPacket {
  tableName: string;
}

export async function checkDatabaseHealth(
  pool: Pool,
  databaseName: string,
): Promise<DatabaseHealth> {
  const placeholders = DATABASE_TABLES.map(() => "?").join(", ");

  try {
    const [rows] = await pool.query<TableRow[]>(
      `
        SELECT table_name AS tableName
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_name IN (${placeholders})
      `,
      [databaseName, ...DATABASE_TABLES],
    );
    const foundTables = new Set(rows.map((row) => row.tableName));
    const missingTables = DATABASE_TABLES.filter((table) => !foundTables.has(table));

    return {
      expectedTables: DATABASE_TABLES,
      missingTables,
      status: missingTables.length === 0 ? "ok" : "schema_incomplete",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown database error",
      expectedTables: DATABASE_TABLES,
      missingTables: [...DATABASE_TABLES],
      status: "unavailable",
    };
  }
}
