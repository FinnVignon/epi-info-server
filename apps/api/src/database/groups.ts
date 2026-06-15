import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type { DisplayGroup } from "../../../shared/groupContracts.js";

export type GroupAdminAction = "manage_assignments" | "manage_groups";

interface GroupRow extends RowDataPacket {
  createdAt: Date;
  id: string;
  memberCount: number | string;
  name: string;
  updatedAt: Date;
}

export interface ListGroupsForAdminInput {
  isSuperAdmin: boolean;
  permissionAction: GroupAdminAction;
  userId: string;
}

export interface CreateGroupInput {
  id: string;
  name: string;
}

export interface UpdateGroupInput {
  groupId: string;
  name: string;
}

const GROUP_SELECT_FIELDS = `
  display_groups.id,
  display_groups.name,
  COUNT(client_groups.client_id) AS memberCount,
  display_groups.created_at AS createdAt,
  display_groups.updated_at AS updatedAt
`;

export async function listGroupsForAdmin(
  pool: Pool,
  input: ListGroupsForAdminInput,
): Promise<DisplayGroup[]> {
  const permissionColumn =
    input.permissionAction === "manage_assignments"
      ? "can_manage_assignments"
      : "can_manage_groups";
  const permissionClause = input.isSuperAdmin
    ? ""
    : `
      WHERE EXISTS (
        SELECT 1
        FROM admin_permissions
        WHERE admin_permissions.user_id = ?
          AND admin_permissions.${permissionColumn} = TRUE
          AND (
            admin_permissions.target_type = 'global'
            OR (
              admin_permissions.target_type = 'group'
              AND admin_permissions.target_id = display_groups.id
            )
          )
      )
    `;
  const [rows] = await pool.execute<GroupRow[]>(
    `
      SELECT
        ${GROUP_SELECT_FIELDS}
      FROM display_groups
      LEFT JOIN client_groups ON client_groups.group_id = display_groups.id
      ${permissionClause}
      GROUP BY
        display_groups.id,
        display_groups.name,
        display_groups.created_at,
        display_groups.updated_at
      ORDER BY display_groups.name
    `,
    input.isSuperAdmin ? [] : [input.userId],
  );

  return rows.map(mapGroup);
}

export async function findGroupById(pool: Pool, groupId: string): Promise<DisplayGroup | null> {
  const [rows] = await pool.execute<GroupRow[]>(
    `
      SELECT
        ${GROUP_SELECT_FIELDS}
      FROM display_groups
      LEFT JOIN client_groups ON client_groups.group_id = display_groups.id
      WHERE display_groups.id = ?
      GROUP BY
        display_groups.id,
        display_groups.name,
        display_groups.created_at,
        display_groups.updated_at
      LIMIT 1
    `,
    [groupId],
  );

  return rows[0] ? mapGroup(rows[0]) : null;
}

export async function createGroup(pool: Pool, input: CreateGroupInput): Promise<void> {
  await pool.execute<ResultSetHeader>("INSERT INTO display_groups (id, name) VALUES (?, ?)", [
    input.id,
    input.name,
  ]);
}

export async function updateGroup(pool: Pool, input: UpdateGroupInput): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE display_groups SET name = ? WHERE id = ?",
    [input.name, input.groupId],
  );

  return result.affectedRows > 0;
}

export async function deleteGroup(pool: Pool, groupId: string): Promise<boolean> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
      "DELETE FROM admin_permissions WHERE target_type = 'group' AND target_id = ?",
      [groupId],
    );
    await connection.execute<ResultSetHeader>(
      "DELETE FROM assignments WHERE target_type = 'group' AND target_id = ?",
      [groupId],
    );
    const [result] = await connection.execute<ResultSetHeader>(
      "DELETE FROM display_groups WHERE id = ?",
      [groupId],
    );
    await connection.commit();

    return result.affectedRows > 0;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function addClientToGroup(
  pool: Pool,
  groupId: string,
  clientId: string,
): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
      "INSERT IGNORE INTO client_groups (client_id, group_id) VALUES (?, ?)",
      [clientId, groupId],
    );
    await connection.execute<ResultSetHeader>(
      "UPDATE display_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [groupId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function removeClientFromGroup(
  pool: Pool,
  groupId: string,
  clientId: string,
): Promise<void> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await connection.execute<ResultSetHeader>(
      "DELETE FROM client_groups WHERE client_id = ? AND group_id = ?",
      [clientId, groupId],
    );
    await connection.execute<ResultSetHeader>(
      "UPDATE display_groups SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [groupId],
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function mapGroup(row: GroupRow): DisplayGroup {
  return {
    createdAt: row.createdAt.toISOString(),
    id: row.id,
    memberCount: Number(row.memberCount),
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
  };
}
