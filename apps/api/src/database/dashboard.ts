import { Pool, RowDataPacket } from "mysql2/promise";

import type { DashboardResponse } from "../../../shared/dashboardContracts.js";

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

export interface DashboardSummaryInput {
  isSuperAdmin: boolean;
  offlineAfterSeconds: number;
  userId: string;
}

export async function getDashboardSummary(
  pool: Pool,
  input: DashboardSummaryInput,
): Promise<DashboardResponse> {
  const clientPermissionClause = input.isSuperAdmin
    ? ""
    : `
      WHERE EXISTS (
        SELECT 1
        FROM admin_permissions
        WHERE admin_permissions.user_id = ?
          AND admin_permissions.can_manage_clients = TRUE
          AND (
            admin_permissions.target_type = 'global'
            OR (
              admin_permissions.target_type = 'client'
              AND admin_permissions.target_id = clients.id
            )
            OR (
              admin_permissions.target_type = 'group'
              AND admin_permissions.target_id IN (
                SELECT client_groups.group_id
                FROM client_groups
                WHERE client_groups.client_id = clients.id
              )
            )
          )
      )
    `;
  const [clients] = await pool.execute<ClientSummaryRow[]>(
    `
      SELECT
        clients.id,
        clients.name,
        CASE
          WHEN clients.last_seen_at IS NULL THEN 'unknown'
          WHEN TIMESTAMPDIFF(SECOND, clients.last_seen_at, NOW()) <= ? THEN 'online'
          ELSE 'offline'
        END AS status,
        clients.current_manifest_id AS currentManifestId,
        clients.last_seen_at AS lastSeenAt
      FROM clients
      ${clientPermissionClause}
      ORDER BY clients.updated_at DESC
      LIMIT 8
    `,
    input.isSuperAdmin ? [input.offlineAfterSeconds] : [input.offlineAfterSeconds, input.userId],
  );
  const groupPermissionClause = input.isSuperAdmin
    ? ""
    : `
      WHERE EXISTS (
        SELECT 1
        FROM admin_permissions
        WHERE admin_permissions.user_id = ?
          AND admin_permissions.can_manage_groups = TRUE
          AND (
            admin_permissions.target_type = 'global'
            OR (
              admin_permissions.target_type = 'group'
              AND admin_permissions.target_id = display_groups.id
            )
          )
      )
    `;
  const [groups] = await pool.execute<GroupSummaryRow[]>(
    `
      SELECT
        display_groups.id,
        display_groups.name,
        COUNT(client_groups.client_id) AS clientCount
      FROM display_groups
      LEFT JOIN client_groups ON client_groups.group_id = display_groups.id
      ${groupPermissionClause}
      GROUP BY display_groups.id, display_groups.name
      ORDER BY display_groups.updated_at DESC
      LIMIT 8
    `,
    input.isSuperAdmin ? [] : [input.userId],
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
