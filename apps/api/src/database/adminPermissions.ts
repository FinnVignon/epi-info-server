import { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type {
  AdminPermission,
  AdminPermissionAction,
  AdminPermissionActions,
  AdminPermissionTarget,
  AdminPermissionTargetType,
} from "../../../shared/adminContracts.js";

const ADMIN_PERMISSION_ACTION_COLUMNS = {
  manage_assignments: "can_manage_assignments",
  manage_clients: "can_manage_clients",
  manage_content: "can_manage_content",
  manage_groups: "can_manage_groups",
  manage_users: "can_manage_users",
} satisfies Record<AdminPermissionAction, string>;

interface AdminPermissionRow extends RowDataPacket {
  canManageAssignments: 0 | 1 | boolean;
  canManageClients: 0 | 1 | boolean;
  canManageContent: 0 | 1 | boolean;
  canManageGroups: 0 | 1 | boolean;
  canManageUsers: 0 | 1 | boolean;
  createdAt: Date;
  id: string;
  targetId: string | null;
  targetType: AdminPermissionTargetType;
  updatedAt: Date;
  userId: string;
}

interface CountRow extends RowDataPacket {
  count: number;
}

export interface CreateAdminPermissionInput extends AdminPermissionActions {
  id: string;
  target: AdminPermissionTarget;
  userId: string;
}

export interface AdminPermissionCheckInput {
  action: AdminPermissionAction;
  target: AdminPermissionTarget;
  userId: string;
}

export interface AdminAnyPermissionCheckInput {
  action: AdminPermissionAction;
  userId: string;
}

function mapAdminPermission(row: AdminPermissionRow): AdminPermission {
  return {
    canManageAssignments: Boolean(row.canManageAssignments),
    canManageClients: Boolean(row.canManageClients),
    canManageContent: Boolean(row.canManageContent),
    canManageGroups: Boolean(row.canManageGroups),
    canManageUsers: Boolean(row.canManageUsers),
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    targetId: row.targetId,
    targetType: row.targetType,
    updatedAt: row.updatedAt.toISOString(),
    userId: row.userId,
  };
}

export async function createAdminPermission(
  pool: Pool,
  input: CreateAdminPermissionInput,
): Promise<void> {
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO admin_permissions (
        id,
        user_id,
        target_type,
        target_id,
        can_manage_users,
        can_manage_clients,
        can_manage_groups,
        can_manage_content,
        can_manage_assignments
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.userId,
      input.target.targetType,
      input.target.targetId,
      input.canManageUsers,
      input.canManageClients,
      input.canManageGroups,
      input.canManageContent,
      input.canManageAssignments,
    ],
  );
}

export async function deleteAdminPermission(pool: Pool, permissionId: string): Promise<void> {
  await pool.execute<ResultSetHeader>("DELETE FROM admin_permissions WHERE id = ?", [permissionId]);
}

export async function deleteAdminPermissionsForUser(pool: Pool, userId: string): Promise<void> {
  await pool.execute<ResultSetHeader>("DELETE FROM admin_permissions WHERE user_id = ?", [userId]);
}

export async function replaceAdminPermissionsForUser(
  pool: Pool,
  userId: string,
  permissions: CreateAdminPermissionInput[],
): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>("DELETE FROM admin_permissions WHERE user_id = ?", [
      userId,
    ]);

    for (const permission of permissions) {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO admin_permissions (
            id,
            user_id,
            target_type,
            target_id,
            can_manage_users,
            can_manage_clients,
            can_manage_groups,
            can_manage_content,
            can_manage_assignments
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          permission.id,
          userId,
          permission.target.targetType,
          permission.target.targetId,
          permission.canManageUsers,
          permission.canManageClients,
          permission.canManageGroups,
          permission.canManageContent,
          permission.canManageAssignments,
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listAdminPermissionsForUser(
  pool: Pool,
  userId: string,
): Promise<AdminPermission[]> {
  const [rows] = await pool.execute<AdminPermissionRow[]>(
    `
      SELECT
        id,
        user_id AS userId,
        target_type AS targetType,
        target_id AS targetId,
        can_manage_users AS canManageUsers,
        can_manage_clients AS canManageClients,
        can_manage_groups AS canManageGroups,
        can_manage_content AS canManageContent,
        can_manage_assignments AS canManageAssignments,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM admin_permissions
      WHERE user_id = ?
      ORDER BY target_type, target_id
    `,
    [userId],
  );

  return rows.map(mapAdminPermission);
}

export async function adminUserHasPermission(
  pool: Pool,
  input: AdminPermissionCheckInput,
): Promise<boolean> {
  const actionColumn = ADMIN_PERMISSION_ACTION_COLUMNS[input.action];
  const { clause, parameters } = createTargetClause(input.target);
  const [rows] = await pool.execute<CountRow[]>(
    `
      SELECT COUNT(*) AS count
      FROM admin_permissions
      WHERE user_id = ?
        AND ${actionColumn} = TRUE
        AND ${clause}
    `,
    [input.userId, ...parameters],
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

export async function adminUserHasAnyPermission(
  pool: Pool,
  input: AdminAnyPermissionCheckInput,
): Promise<boolean> {
  const actionColumn = ADMIN_PERMISSION_ACTION_COLUMNS[input.action];
  const [rows] = await pool.execute<CountRow[]>(
    `
      SELECT COUNT(*) AS count
      FROM admin_permissions
      WHERE user_id = ?
        AND ${actionColumn} = TRUE
    `,
    [input.userId],
  );

  return Number(rows[0]?.count ?? 0) > 0;
}

function createTargetClause(target: AdminPermissionTarget): {
  clause: string;
  parameters: string[];
} {
  if (target.targetType === "global") {
    return {
      clause: "target_type = 'global'",
      parameters: [],
    };
  }

  if (target.targetType === "group") {
    return {
      clause: "(target_type = 'global' OR (target_type = 'group' AND target_id = ?))",
      parameters: [target.targetId],
    };
  }

  return {
    clause: `
      (
        target_type = 'global'
        OR (target_type = 'client' AND target_id = ?)
        OR (
          target_type = 'group'
          AND target_id IN (
            SELECT group_id
            FROM client_groups
            WHERE client_id = ?
          )
        )
      )
    `,
    parameters: [target.targetId, target.targetId],
  };
}
