import { createPool, Pool, RowDataPacket } from "mysql2/promise";

import { ServerConfig } from "./config.js";

export const DATABASE_TABLES = [
  "clients",
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

export function createDatabasePool(config: ServerConfig["mysql"]): Pool {
  return createPool({
    database: config.database,
    host: config.host,
    password: config.password,
    port: config.port,
    user: config.user,
    waitForConnections: true,
    connectionLimit: 5,
  });
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
