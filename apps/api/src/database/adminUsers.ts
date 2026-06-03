import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { toIsoString } from "./utils.js";
import type { AdminUser } from "../../../shared/adminContracts.js";

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

interface CountRow extends RowDataPacket {
  count: number;
}

export interface AdminUserWithPasswordHash extends AdminUser {
  passwordHash: string;
}

export interface CreateAdminUserInput {
  displayName: string;
  email: string;
  id: string;
  isSuperAdmin: boolean;
  passwordHash: string;
}

export interface UpdateAdminUserStatusInput {
  status: AdminUser["status"];
  userId: string;
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

export async function findAdminUserById(pool: Pool, userId: string): Promise<AdminUser | null> {
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
      WHERE id = ?
      LIMIT 1
    `,
    [userId],
  );
  const user = rows[0];

  return user ? mapAdminUser(user) : null;
}

export async function listAdminUsers(pool: Pool): Promise<AdminUser[]> {
  const [rows] = await pool.query<AdminUserRow[]>(
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
      ORDER BY created_at DESC
    `,
  );

  return rows.map(mapAdminUser);
}

export async function updateAdminLastLogin(pool: Pool, userId: string): Promise<void> {
  await pool.execute<ResultSetHeader>("UPDATE admin_users SET last_login_at = NOW() WHERE id = ?", [
    userId,
  ]);
}

export async function updateAdminUserPasswordHash(
  pool: Pool,
  userId: string,
  passwordHash: string,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE admin_users SET password_hash = ? WHERE id = ?",
    [passwordHash, userId],
  );

  return result.affectedRows > 0;
}

export async function updateAdminUserStatus(
  pool: Pool,
  input: UpdateAdminUserStatusInput,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE admin_users SET status = ? WHERE id = ?",
    [input.status, input.userId],
  );

  return result.affectedRows > 0;
}
