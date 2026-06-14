import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type {
  FitMode,
  Manifest,
  ManifestItem,
  ManifestItemType,
} from "../../../shared/contracts.js";

interface AssignmentManifestRow extends RowDataPacket {
  assignmentId: string;
  manifestId: string;
  name: string;
  version: number;
}

interface EffectiveManifestRow extends RowDataPacket {
  id: string;
  name: string;
  version: number;
}

interface ManifestItemRow extends RowDataPacket {
  assetId: string | null;
  durationSeconds: number;
  fit: FitMode | null;
  id: string;
  localPath: string | null;
  position: number;
  remoteUrl: string | null;
  sha256: string | null;
  textBody: string | null;
  type: ManifestItemType;
  url: string | null;
}

export type AssignmentTargetType = "client" | "group";

export interface AssignAssetToTargetInput {
  assetId: string;
  assignmentId: string;
  durationSeconds: number;
  fit: FitMode;
  itemId: string;
  localPath: string;
  manifestId: string;
  manifestName: string;
  remoteUrl: string;
  sha256: string;
  targetId: string;
  targetType: AssignmentTargetType;
  type: "image" | "video";
}

export async function assignAssetToTarget(
  pool: Pool,
  input: AssignAssetToTargetInput,
): Promise<Manifest> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await findAssignmentForUpdate(connection, input.targetType, input.targetId);
    const manifestId = existing?.manifestId ?? input.manifestId;
    const version = existing ? existing.version + 1 : 1;

    if (existing) {
      await connection.execute<ResultSetHeader>(
        `
          UPDATE manifests
          SET
            name = ?,
            version = ?
          WHERE id = ?
        `,
        [input.manifestName, version, manifestId],
      );
      await connection.execute<ResultSetHeader>(
        "DELETE FROM manifest_items WHERE manifest_id = ?",
        [manifestId],
      );
    } else {
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO manifests (id, name, version)
          VALUES (?, ?, ?)
        `,
        [manifestId, input.manifestName, version],
      );
      await connection.execute<ResultSetHeader>(
        `
          INSERT INTO assignments (id, target_type, target_id, manifest_id)
          VALUES (?, ?, ?, ?)
        `,
        [input.assignmentId, input.targetType, input.targetId, manifestId],
      );
    }

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO manifest_items (
          id,
          manifest_id,
          position,
          type,
          asset_id,
          remote_url,
          local_path,
          duration_seconds,
          fit,
          sha256
        )
        VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.itemId,
        manifestId,
        input.type,
        input.assetId,
        input.remoteUrl,
        input.localPath,
        input.durationSeconds,
        input.fit,
        input.sha256,
      ],
    );
    await connection.commit();

    return {
      id: manifestId,
      items: [
        {
          assetId: input.assetId,
          durationSeconds: input.durationSeconds,
          fit: input.fit,
          id: input.itemId,
          localPath: input.localPath,
          remoteUrl: input.remoteUrl,
          sha256: input.sha256,
          type: input.type,
        },
      ],
      name: input.manifestName,
      version,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function removeAssignmentFromTarget(
  pool: Pool,
  targetType: AssignmentTargetType,
  targetId: string,
): Promise<boolean> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await findAssignmentForUpdate(connection, targetType, targetId);

    if (!existing) {
      await connection.commit();
      return false;
    }

    await connection.execute<ResultSetHeader>("DELETE FROM assignments WHERE id = ?", [
      existing.assignmentId,
    ]);
    await connection.execute<ResultSetHeader>("DELETE FROM manifests WHERE id = ?", [
      existing.manifestId,
    ]);
    await connection.commit();

    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function findEffectiveManifestForClient(
  pool: Pool,
  clientId: string,
): Promise<Manifest | null> {
  const [manifestRows] = await pool.execute<EffectiveManifestRow[]>(
    `
      SELECT
        manifests.id,
        manifests.name,
        manifests.version
      FROM assignments
      INNER JOIN manifests ON manifests.id = assignments.manifest_id
      WHERE
        (assignments.target_type = 'client' AND assignments.target_id = ?)
        OR (
          assignments.target_type = 'group'
          AND assignments.target_id IN (
            SELECT group_id
            FROM client_groups
            WHERE client_id = ?
          )
        )
        OR assignments.target_type = 'global'
      ORDER BY
        CASE assignments.target_type
          WHEN 'client' THEN 1
          WHEN 'group' THEN 2
          ELSE 3
        END,
        assignments.updated_at DESC
      LIMIT 1
    `,
    [clientId, clientId],
  );
  const manifestRow = manifestRows[0];

  if (!manifestRow) {
    return null;
  }

  const [itemRows] = await pool.execute<ManifestItemRow[]>(
    `
      SELECT
        id,
        position,
        type,
        asset_id AS assetId,
        remote_url AS remoteUrl,
        local_path AS localPath,
        duration_seconds AS durationSeconds,
        fit,
        sha256,
        text_body AS textBody,
        url
      FROM manifest_items
      WHERE manifest_id = ?
      ORDER BY position
    `,
    [manifestRow.id],
  );

  return {
    id: manifestRow.id,
    items: itemRows.map(mapManifestItem),
    name: manifestRow.name,
    version: Number(manifestRow.version),
  };
}

async function findAssignmentForUpdate(
  connection: PoolConnection,
  targetType: AssignmentTargetType,
  targetId: string,
): Promise<AssignmentManifestRow | null> {
  const [rows] = await connection.execute<AssignmentManifestRow[]>(
    `
      SELECT
        assignments.id AS assignmentId,
        manifests.id AS manifestId,
        manifests.name,
        manifests.version
      FROM assignments
      INNER JOIN manifests ON manifests.id = assignments.manifest_id
      WHERE assignments.target_type = ?
        AND assignments.target_id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [targetType, targetId],
  );

  return rows[0] ?? null;
}

function mapManifestItem(row: ManifestItemRow): ManifestItem {
  const baseItem = {
    durationSeconds: Number(row.durationSeconds),
    id: row.id,
  };

  if (row.type === "image" || row.type === "video") {
    if (!row.assetId || !row.fit || !row.localPath || !row.remoteUrl || !row.sha256) {
      throw new Error(`Media manifest item ${row.id} is incomplete`);
    }

    return {
      ...baseItem,
      assetId: row.assetId,
      fit: row.fit,
      localPath: row.localPath,
      remoteUrl: row.remoteUrl,
      sha256: row.sha256,
      type: row.type,
    };
  }

  if (row.type === "text") {
    if (row.textBody === null) {
      throw new Error(`Text manifest item ${row.id} is incomplete`);
    }

    return {
      ...baseItem,
      text: row.textBody,
      type: "text",
    };
  }

  if (!row.url) {
    throw new Error(`Web page manifest item ${row.id} is incomplete`);
  }

  return {
    ...baseItem,
    type: "webpage",
    url: row.url,
  };
}
