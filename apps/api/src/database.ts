import { createPool, Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

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

interface AdminUserRow extends RowDataPacket {
  createdAt: Date;
  displayName: string;
  email: string;
  id: string;
  isSuperAdmin: 0 | 1 | boolean;
  lastLoginAt: Date | null;
  passwordHash: string;
  status: "active" | "disabled";
  updatedAt: Date;
}

interface AdminSessionRow extends RowDataPacket {
  createdAt: Date;
  email: string;
  expiresAt: Date;
  id: string;
  isSuperAdmin: 0 | 1 | boolean;
  lastSeenAt: Date | null;
  sessionUserId: string;
  status: "active" | "disabled";
  userCreatedAt: Date;
  userDisplayName: string;
  userLastLoginAt: Date | null;
  userUpdatedAt: Date;
}

interface CountRow extends RowDataPacket {
  count: number;
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

export interface AdminUser {
  createdAt: string;
  displayName: string;
  email: string;
  id: string;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  status: "active" | "disabled";
  updatedAt: string;
}

export interface AdminUserWithPasswordHash extends AdminUser {
  passwordHash: string;
}

export interface AdminSessionWithUser {
  createdAt: string;
  expiresAt: string;
  id: string;
  lastSeenAt: string | null;
  user: AdminUser;
}

export interface CreateAdminUserInput {
  displayName: string;
  email: string;
  id: string;
  isSuperAdmin: boolean;
  passwordHash: string;
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

function toIsoString(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function mapAdminUser(row: AdminUserRow): AdminUser {
  return {
    createdAt: row.createdAt.toISOString(),
    displayName: row.displayName,
    email: row.email,
    id: row.id,
    isSuperAdmin: Boolean(row.isSuperAdmin),
    lastLoginAt: toIsoString(row.lastLoginAt),
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapAdminUserWithPasswordHash(row: AdminUserRow): AdminUserWithPasswordHash {
  return {
    ...mapAdminUser(row),
    passwordHash: row.passwordHash,
  };
}

export async function countAdminUsers(pool: Pool): Promise<number> {
  const [rows] = await pool.query<CountRow[]>("SELECT COUNT(*) AS count FROM admin_users");

  return rows[0]?.count ?? 0;
}

export async function createAdminUser(pool: Pool, input: CreateAdminUserInput): Promise<AdminUser> {
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO admin_users (
        id,
        email,
        display_name,
        password_hash,
        is_super_admin
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [input.id, input.email, input.displayName, input.passwordHash, input.isSuperAdmin],
  );

  const createdUser = await findAdminUserByEmail(pool, input.email);

  if (!createdUser) {
    throw new Error("Created admin user could not be loaded");
  }

  const { passwordHash: _passwordHash, ...safeUser } = createdUser;

  return safeUser;
}

export async function findAdminUserByEmail(
  pool: Pool,
  email: string,
): Promise<AdminUserWithPasswordHash | null> {
  const [rows] = await pool.execute<AdminUserRow[]>(
    `
      SELECT
        id,
        email,
        display_name AS displayName,
        password_hash AS passwordHash,
        status,
        is_super_admin AS isSuperAdmin,
        last_login_at AS lastLoginAt,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM admin_users
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );
  const user = rows[0];

  return user ? mapAdminUserWithPasswordHash(user) : null;
}

export async function updateAdminLastLogin(pool: Pool, userId: string): Promise<void> {
  await pool.execute<ResultSetHeader>("UPDATE admin_users SET last_login_at = NOW() WHERE id = ?", [
    userId,
  ]);
}

export async function createAdminSession(
  pool: Pool,
  input: {
    expiresAt: Date;
    id: string;
    tokenHash: string;
    userId: string;
  },
): Promise<void> {
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO admin_sessions (
        id,
        user_id,
        token_hash,
        expires_at
      )
      VALUES (?, ?, ?, ?)
    `,
    [input.id, input.userId, input.tokenHash, input.expiresAt],
  );
}

export async function deleteAdminSession(pool: Pool, tokenHash: string): Promise<void> {
  await pool.execute<ResultSetHeader>("DELETE FROM admin_sessions WHERE token_hash = ?", [
    tokenHash,
  ]);
}

export async function findAdminSessionByTokenHash(
  pool: Pool,
  tokenHash: string,
): Promise<AdminSessionWithUser | null> {
  const [rows] = await pool.execute<AdminSessionRow[]>(
    `
      SELECT
        admin_sessions.id,
        admin_sessions.user_id AS sessionUserId,
        admin_sessions.expires_at AS expiresAt,
        admin_sessions.created_at AS createdAt,
        admin_sessions.last_seen_at AS lastSeenAt,
        admin_users.email,
        admin_users.display_name AS userDisplayName,
        admin_users.status,
        admin_users.is_super_admin AS isSuperAdmin,
        admin_users.last_login_at AS userLastLoginAt,
        admin_users.created_at AS userCreatedAt,
        admin_users.updated_at AS userUpdatedAt
      FROM admin_sessions
      INNER JOIN admin_users ON admin_users.id = admin_sessions.user_id
      WHERE admin_sessions.token_hash = ?
        AND admin_sessions.expires_at > NOW()
        AND admin_users.status = 'active'
      LIMIT 1
    `,
    [tokenHash],
  );
  const session = rows[0];

  if (!session) {
    return null;
  }

  return {
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    id: session.id,
    lastSeenAt: toIsoString(session.lastSeenAt),
    user: {
      createdAt: session.userCreatedAt.toISOString(),
      displayName: session.userDisplayName,
      email: session.email,
      id: session.sessionUserId,
      isSuperAdmin: Boolean(session.isSuperAdmin),
      lastLoginAt: toIsoString(session.userLastLoginAt),
      status: session.status,
      updatedAt: session.userUpdatedAt.toISOString(),
    },
  };
}

export async function touchAdminSession(pool: Pool, sessionId: string): Promise<void> {
  await pool.execute<ResultSetHeader>(
    "UPDATE admin_sessions SET last_seen_at = NOW() WHERE id = ?",
    [sessionId],
  );
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
