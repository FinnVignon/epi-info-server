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
  refreshSeconds: number | null;
  sha256: string | null;
  textBody: string | null;
  type: ManifestItemType;
  url: string | null;
}

interface TimestampPrecisionRow extends RowDataPacket {
  datetimePrecision: number | null;
}

interface ColumnExistsRow extends RowDataPacket {
  columnName: string;
}

export type AssignmentTarget =
  | {
      targetId: null;
      targetType: "global";
    }
  | {
      targetId: string;
      targetType: "client" | "group";
    };

interface AssignManifestItemToTargetFields {
  assignmentId: string;
  item: ManifestItem;
  manifestId: string;
  manifestName: string;
}

export type AssignManifestItemToTargetInput = AssignManifestItemToTargetFields & AssignmentTarget;

interface AssignAssetToTargetFields {
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
  type: "image" | "video";
}

export type AssignAssetToTargetInput = AssignAssetToTargetFields & AssignmentTarget;

export async function ensureAssignmentSchema(pool: Pool, databaseName: string): Promise<void> {
  const [rows] = await pool.execute<TimestampPrecisionRow[]>(
    `
      SELECT DATETIME_PRECISION AS datetimePrecision
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'assignments'
        AND COLUMN_NAME = 'updated_at'
      LIMIT 1
    `,
    [databaseName],
  );

  if (!rows[0] || Number(rows[0].datetimePrecision ?? 0) === 6) {
    return;
  }

  await pool.execute(`
    ALTER TABLE assignments
      MODIFY COLUMN created_at
        TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      MODIFY COLUMN updated_at
        TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6)
  `);
}

export async function ensureAssignmentContentSchema(
  pool: Pool,
  databaseName: string,
): Promise<void> {
  await pool.execute(`
    ALTER TABLE manifest_items
      MODIFY COLUMN type ENUM('image', 'video', 'text', 'webpage', 'live_web_link') NOT NULL
  `);

  const [refreshRows] = await pool.execute<ColumnExistsRow[]>(
    `
      SELECT COLUMN_NAME AS columnName
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'manifest_items'
        AND COLUMN_NAME = 'refresh_seconds'
      LIMIT 1
    `,
    [databaseName],
  );

  if (!refreshRows[0]) {
    await pool.execute(`
      ALTER TABLE manifest_items
        ADD COLUMN refresh_seconds INT UNSIGNED NULL AFTER url
    `);
  }

  await pool.execute(`
    UPDATE manifest_items
    SET
      type = 'live_web_link',
      refresh_seconds = COALESCE(refresh_seconds, 60)
    WHERE type = 'webpage'
  `);

  await pool.execute(`
    ALTER TABLE manifest_items
      MODIFY COLUMN type ENUM('image', 'video', 'text', 'live_web_link') NOT NULL
  `);
}

export async function assignManifestItemToTarget(
  pool: Pool,
  input: AssignManifestItemToTargetInput,
): Promise<Manifest> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const existing = await findAssignmentForUpdate(connection, input);
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
      await connection.execute<ResultSetHeader>(
        `
          UPDATE assignments
          SET updated_at = CURRENT_TIMESTAMP(6)
          WHERE id = ?
        `,
        [existing.assignmentId],
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
          sha256,
          text_body,
          url,
          refresh_seconds
        )
        VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.item.id,
        manifestId,
        input.item.type,
        "assetId" in input.item ? input.item.assetId : null,
        "remoteUrl" in input.item ? input.item.remoteUrl : null,
        "localPath" in input.item ? input.item.localPath : null,
        input.item.durationSeconds,
        "fit" in input.item ? input.item.fit : null,
        "sha256" in input.item ? input.item.sha256 : null,
        input.item.type === "text" ? input.item.text : null,
        input.item.type === "live_web_link" ? input.item.url : null,
        input.item.type === "live_web_link" ? input.item.refreshSeconds : null,
      ],
    );

    await connection.commit();

    return {
      id: manifestId,
      items: [input.item],
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

export async function assignAssetToTarget(
  pool: Pool,
  input: AssignAssetToTargetInput,
): Promise<Manifest> {
  const manifestInput = {
    assignmentId: input.assignmentId,
    item: {
      assetId: input.assetId,
      durationSeconds: input.durationSeconds,
      fit: input.fit,
      id: input.itemId,
      localPath: input.localPath,
      remoteUrl: input.remoteUrl,
      sha256: input.sha256,
      type: input.type,
    },
    manifestId: input.manifestId,
    manifestName: input.manifestName,
  };

  return input.targetType === "global"
    ? assignManifestItemToTarget(pool, {
        ...manifestInput,
        targetId: null,
        targetType: "global",
      })
    : assignManifestItemToTarget(pool, {
        ...manifestInput,
        targetId: input.targetId,
        targetType: input.targetType,
      });
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
        url,
        refresh_seconds AS refreshSeconds
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
  target: AssignmentTarget,
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
        AND assignments.target_id <=> ?
      LIMIT 1
      FOR UPDATE
    `,
    [target.targetType, target.targetId],
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

  if (row.type !== "live_web_link" || !row.url || row.refreshSeconds === null) {
    throw new Error(`Live web link manifest item ${row.id} is incomplete`);
  }

  return {
    ...baseItem,
    refreshSeconds: Number(row.refreshSeconds),
    type: "live_web_link",
    url: row.url,
  };
}
