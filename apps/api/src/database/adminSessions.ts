import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { toIsoString } from "./utils.js";
import type { AdminUser } from "../../../shared/adminContracts.js";

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

export interface AdminSessionWithUser {
  createdAt: string;
  expiresAt: string;
  id: string;
  lastSeenAt: string | null;
  user: AdminUser;
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
