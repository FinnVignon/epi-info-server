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

export async function getDashboardSummary(pool: Pool): Promise<DashboardResponse> {
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
