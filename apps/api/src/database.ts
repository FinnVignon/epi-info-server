import { createPool, Pool, RowDataPacket } from "mysql2/promise";

import { ServerConfig } from "./config.js";

export const DATABASE_TABLES = [
  "admin_users",
  "admin_permissions",
  "admin_sessions",
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

interface ClientSummaryRow extends RowDataPacket {
  currentManifestId: string | null;
  id: string;
  lastSeenAt: Date | null;
  name: string;
  status: "online" | "offline" | "unknown";
}

interface GroupSummaryRow extends RowDataPacket {
  clientCount: number | string;
  id: string;
  name: string;
}

export interface DashboardClientSummary {
  currentManifestId: string | null;
  id: string;
  lastSeenAt: string | null;
  name: string;
  status: "online" | "offline" | "unknown";
}

export interface DashboardGroupSummary {
  clientCount: number;
  id: string;
  name: string;
}

export interface DashboardSummary {
  clients: DashboardClientSummary[];
  groups: DashboardGroupSummary[];
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

export async function getDashboardSummary(pool: Pool): Promise<DashboardSummary> {
  const [clients] = await pool.query<ClientSummaryRow[]>(
    `
      SELECT
        id,
        name,
        status,
        current_manifest_id AS currentManifestId,
        last_seen_at AS lastSeenAt
      FROM clients
      ORDER BY updated_at DESC
      LIMIT 8
    `,
  );
  const [groups] = await pool.query<GroupSummaryRow[]>(
    `
      SELECT
        display_groups.id,
        display_groups.name,
        COUNT(client_groups.client_id) AS clientCount
      FROM display_groups
      LEFT JOIN client_groups ON client_groups.group_id = display_groups.id
      GROUP BY display_groups.id, display_groups.name
      ORDER BY display_groups.updated_at DESC
      LIMIT 8
    `,
  );

  return {
    clients: clients.map((client) => ({
      currentManifestId: client.currentManifestId,
      id: client.id,
      lastSeenAt: client.lastSeenAt?.toISOString() ?? null,
      name: client.name,
      status: client.status,
    })),
    groups: groups.map((group) => ({
      clientCount: Number(group.clientCount),
      id: group.id,
      name: group.name,
    })),
  };
}
