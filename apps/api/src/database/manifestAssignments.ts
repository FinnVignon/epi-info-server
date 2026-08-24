import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type { FitMode, Manifest, ManifestItem } from "../../../shared/contracts.js";

interface AssignmentManifestRow extends RowDataPacket {
  assignmentId: string;
  manifestId: string;
  name: string;
  version: number;
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

    await saveManifest(connection, input, existing, manifestId, version);
    await saveManifestItem(connection, manifestId, input.item);
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

async function saveManifest(
  connection: PoolConnection,
  input: AssignManifestItemToTargetInput,
  existing: AssignmentManifestRow | null,
  manifestId: string,
  version: number,
): Promise<void> {
  if (!existing) {
    await connection.execute<ResultSetHeader>(
      "INSERT INTO manifests (id, name, version) VALUES (?, ?, ?)",
      [manifestId, input.manifestName, version],
    );
    await connection.execute<ResultSetHeader>(
      "INSERT INTO assignments (id, target_type, target_id, manifest_id) VALUES (?, ?, ?, ?)",
      [input.assignmentId, input.targetType, input.targetId, manifestId],
    );
    return;
  }

  await connection.execute<ResultSetHeader>(
    "UPDATE manifests SET name = ?, version = ? WHERE id = ?",
    [input.manifestName, version, manifestId],
  );
  await connection.execute<ResultSetHeader>("DELETE FROM manifest_items WHERE manifest_id = ?", [
    manifestId,
  ]);
  await connection.execute<ResultSetHeader>(
    "UPDATE assignments SET updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
    [existing.assignmentId],
  );
}

async function saveManifestItem(
  connection: PoolConnection,
  manifestId: string,
  item: ManifestItem,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO manifest_items (
        id, manifest_id, position, type, asset_id, remote_url, local_path,
        duration_seconds, fit, sha256, text_body, url, refresh_seconds
      )
      VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      item.id,
      manifestId,
      item.type,
      "assetId" in item ? item.assetId : null,
      "remoteUrl" in item ? item.remoteUrl : null,
      "localPath" in item ? item.localPath : null,
      item.durationSeconds,
      "fit" in item ? item.fit : null,
      "sha256" in item ? item.sha256 : null,
      item.type === "text" ? item.text : null,
      item.type === "live_web_link" ? item.url : null,
      item.type === "live_web_link" ? item.refreshSeconds : null,
    ],
  );
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
