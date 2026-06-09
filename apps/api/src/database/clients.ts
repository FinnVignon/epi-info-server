import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type {
  ClientAccessStatus,
  ClientConnectionStatus,
  ManagedClient,
} from "../../../shared/clientContracts.js";

export type ClientAdminAction = "manage_assignments" | "manage_clients";

interface ClientRow extends RowDataPacket {
  accessStatus: ClientAccessStatus;
  connectionStatus: ClientConnectionStatus;
  createdAt: Date;
  currentManifestId: string | null;
  currentManifestVersion: number | null;
  id: string;
  lastError: string | null;
  lastSeenAt: Date | null;
  lastSyncResult: string | null;
  name: string;
  softwareVersion: string | null;
  updatedAt: Date;
}

export interface ListClientsForAdminInput {
  isSuperAdmin: boolean;
  offlineAfterSeconds: number;
  permissionAction: ClientAdminAction;
  userId: string;
}

export interface UpdateClientProfileInput {
  clientId: string;
  name: string;
}

export interface UpdateClientStatusInput {
  accessStatus: ClientAccessStatus;
  clientId: string;
}

const CLIENT_SELECT_FIELDS = `
  clients.id,
  clients.name,
  clients.access_status AS accessStatus,
  CASE
    WHEN clients.last_seen_at IS NULL THEN 'unknown'
    WHEN TIMESTAMPDIFF(SECOND, clients.last_seen_at, NOW()) <= ? THEN 'online'
    ELSE 'offline'
  END AS connectionStatus,
  clients.software_version AS softwareVersion,
  clients.current_manifest_id AS currentManifestId,
  clients.current_manifest_version AS currentManifestVersion,
  clients.last_seen_at AS lastSeenAt,
  clients.last_sync_result AS lastSyncResult,
  clients.last_error AS lastError,
  clients.created_at AS createdAt,
  clients.updated_at AS updatedAt
`;

export async function listClientsForAdmin(
  pool: Pool,
  input: ListClientsForAdminInput,
): Promise<ManagedClient[]> {
  const permissionColumn =
    input.permissionAction === "manage_assignments"
      ? "can_manage_assignments"
      : "can_manage_clients";
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
  const parameters = input.isSuperAdmin
    ? [input.offlineAfterSeconds]
    : [input.offlineAfterSeconds, input.userId];
  const [rows] = await pool.execute<ClientRow[]>(
    `
      SELECT
        ${CLIENT_SELECT_FIELDS}
      FROM clients
      ${permissionClause}
      ORDER BY clients.created_at DESC
    `,
    parameters,
  );

  return rows.map(mapClient);
}

export async function findClientById(
  pool: Pool,
  clientId: string,
  offlineAfterSeconds: number,
): Promise<ManagedClient | null> {
  const [rows] = await pool.execute<ClientRow[]>(
    `
      SELECT
        ${CLIENT_SELECT_FIELDS}
      FROM clients
      WHERE clients.id = ?
      LIMIT 1
    `,
    [offlineAfterSeconds, clientId],
  );

  return rows[0] ? mapClient(rows[0]) : null;
}

export async function updateClientProfile(
  pool: Pool,
  input: UpdateClientProfileInput,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>("UPDATE clients SET name = ? WHERE id = ?", [
    input.name,
    input.clientId,
  ]);

  return result.affectedRows > 0;
}

export async function updateClientStatus(
  pool: Pool,
  input: UpdateClientStatusInput,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      UPDATE clients
      SET access_status = ?
      WHERE id = ?
    `,
    [input.accessStatus, input.clientId],
  );

  return result.affectedRows > 0;
}

function mapClient(row: ClientRow): ManagedClient {
  return {
    accessStatus: row.accessStatus,
    connectionStatus: row.connectionStatus,
    createdAt: row.createdAt.toISOString(),
    currentManifestId: row.currentManifestId,
    currentManifestVersion: row.currentManifestVersion,
    id: row.id,
    lastError: row.lastError,
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    lastSyncResult: row.lastSyncResult,
    name: row.name,
    softwareVersion: row.softwareVersion,
    updatedAt: row.updatedAt.toISOString(),
  };
}
