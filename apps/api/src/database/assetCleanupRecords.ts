import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

interface AssetCleanupCandidateRow extends RowDataPacket {
  id: string;
  storagePath: string;
}

interface CountRow extends RowDataPacket {
  count: number | string;
}

export interface ArchivedAssetCleanupCandidate {
  id: string;
  storagePath: string;
}

const ACTIVE_ASSIGNMENT_REFERENCE_EXISTS = `
  SELECT 1
  FROM manifest_items cleanup_manifest_items
  INNER JOIN assignments cleanup_assignments
    ON cleanup_assignments.manifest_id = cleanup_manifest_items.manifest_id
  WHERE cleanup_manifest_items.asset_id = assets.id
    AND (
      (
        cleanup_assignments.target_type = 'client'
        AND EXISTS (
          SELECT 1
          FROM clients cleanup_clients
          WHERE cleanup_clients.id = cleanup_assignments.target_id
            AND cleanup_clients.access_status = 'active'
        )
      )
      OR (
        cleanup_assignments.target_type = 'group'
        AND EXISTS (
          SELECT 1
          FROM client_groups cleanup_client_groups
          INNER JOIN clients cleanup_group_clients
            ON cleanup_group_clients.id = cleanup_client_groups.client_id
          WHERE cleanup_client_groups.group_id = cleanup_assignments.target_id
            AND cleanup_group_clients.access_status = 'active'
        )
      )
      OR (
        cleanup_assignments.target_type = 'global'
        AND EXISTS (
          SELECT 1
          FROM clients cleanup_global_clients
          WHERE cleanup_global_clients.access_status = 'active'
        )
      )
    )
`;

const ACTIVE_ASSIGNMENT_REFERENCE_COUNT = `
  SELECT COUNT(*) AS count
  FROM manifest_items cleanup_manifest_items
  INNER JOIN assignments cleanup_assignments
    ON cleanup_assignments.manifest_id = cleanup_manifest_items.manifest_id
  WHERE cleanup_manifest_items.asset_id = ?
    AND (
      (
        cleanup_assignments.target_type = 'client'
        AND EXISTS (
          SELECT 1
          FROM clients cleanup_clients
          WHERE cleanup_clients.id = cleanup_assignments.target_id
            AND cleanup_clients.access_status = 'active'
        )
      )
      OR (
        cleanup_assignments.target_type = 'group'
        AND EXISTS (
          SELECT 1
          FROM client_groups cleanup_client_groups
          INNER JOIN clients cleanup_group_clients
            ON cleanup_group_clients.id = cleanup_client_groups.client_id
          WHERE cleanup_client_groups.group_id = cleanup_assignments.target_id
            AND cleanup_group_clients.access_status = 'active'
        )
      )
      OR (
        cleanup_assignments.target_type = 'global'
        AND EXISTS (
          SELECT 1
          FROM clients cleanup_global_clients
          WHERE cleanup_global_clients.access_status = 'active'
        )
      )
    )
`;

export async function listArchivedAssetCleanupCandidates(
  pool: Pool,
  retentionDays: number,
): Promise<ArchivedAssetCleanupCandidate[]> {
  const [rows] = await pool.execute<AssetCleanupCandidateRow[]>(
    `
      SELECT assets.id, assets.storage_path AS storagePath
      FROM assets
      WHERE assets.status = 'archived'
        AND assets.archived_at IS NOT NULL
        AND assets.archived_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND NOT EXISTS (${ACTIVE_ASSIGNMENT_REFERENCE_EXISTS})
      ORDER BY assets.archived_at ASC
    `,
    [retentionDays],
  );

  return rows.map((row) => ({ id: row.id, storagePath: row.storagePath }));
}

export async function deleteArchivedAssetIfEligible(
  pool: Pool,
  assetId: string,
  retentionDays: number,
): Promise<ArchivedAssetCleanupCandidate | null> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const asset = await lockCleanupCandidate(connection, assetId, retentionDays);

    if (!asset || (await hasActiveAssignment(connection, assetId))) {
      await connection.rollback();
      return null;
    }

    await deleteAssetReferences(connection, assetId);
    await connection.execute<ResultSetHeader>("DELETE FROM assets WHERE id = ?", [assetId]);
    await connection.commit();

    return { id: asset.id, storagePath: asset.storagePath };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function lockCleanupCandidate(
  connection: PoolConnection,
  assetId: string,
  retentionDays: number,
): Promise<AssetCleanupCandidateRow | null> {
  const [rows] = await connection.execute<AssetCleanupCandidateRow[]>(
    `
      SELECT id, storage_path AS storagePath
      FROM assets
      WHERE id = ?
        AND status = 'archived'
        AND archived_at IS NOT NULL
        AND archived_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
      LIMIT 1
      FOR UPDATE
    `,
    [assetId, retentionDays],
  );

  return rows[0] ?? null;
}

async function hasActiveAssignment(connection: PoolConnection, assetId: string): Promise<boolean> {
  const [rows] = await connection.execute<CountRow[]>(ACTIVE_ASSIGNMENT_REFERENCE_COUNT, [assetId]);

  return Number(rows[0]?.count ?? 0) > 0;
}

async function deleteAssetReferences(connection: PoolConnection, assetId: string): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      DELETE cleanup_assignments
      FROM assignments cleanup_assignments
      INNER JOIN manifest_items cleanup_manifest_items
        ON cleanup_manifest_items.manifest_id = cleanup_assignments.manifest_id
      WHERE cleanup_manifest_items.asset_id = ?
    `,
    [assetId],
  );
  await connection.execute<ResultSetHeader>(
    `
      DELETE cleanup_manifests
      FROM manifests cleanup_manifests
      INNER JOIN manifest_items cleanup_manifest_items
        ON cleanup_manifest_items.manifest_id = cleanup_manifests.id
      WHERE cleanup_manifest_items.asset_id = ?
    `,
    [assetId],
  );
}
