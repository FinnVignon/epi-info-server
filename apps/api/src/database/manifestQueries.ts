import type { Pool, RowDataPacket } from "mysql2/promise";

import type {
  FitMode,
  Manifest,
  ManifestItem,
  ManifestItemType,
} from "../../../shared/contracts.js";

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

export async function findEffectiveManifestForClient(
  pool: Pool,
  clientId: string,
): Promise<Manifest | null> {
  const [manifestRows] = await pool.execute<EffectiveManifestRow[]>(
    `
      SELECT manifests.id, manifests.name, manifests.version
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
      ORDER BY assignments.updated_at DESC
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

    return { ...baseItem, text: row.textBody, type: "text" };
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
