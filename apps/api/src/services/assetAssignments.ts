import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";

import type { AssignAssetRequest } from "../../../shared/adminContracts.js";
import type { Manifest } from "../../../shared/contracts.js";
import { assignAssetToTarget, findAssetById, type AssignmentTarget } from "../database.js";

const SINGLE_ITEM_DURATION_SECONDS = 30;

export async function assignActiveAssetToTarget(
  pool: Pool,
  assignment: AssignAssetRequest,
  target: AssignmentTarget,
): Promise<Manifest | null> {
  const asset = await findAssetById(pool, assignment.assetId);

  if (!asset || asset.status !== "active") {
    return null;
  }

  const safeFilename = encodeURIComponent(asset.originalFilename);

  return assignAssetToTarget(pool, {
    assetId: asset.id,
    assignmentId: randomUUID(),
    durationSeconds: SINGLE_ITEM_DURATION_SECONDS,
    fit: assignment.fit,
    itemId: randomUUID(),
    localPath: `/assets/${encodeURIComponent(asset.id)}/${safeFilename}`,
    manifestId: randomUUID(),
    manifestName: asset.displayName,
    remoteUrl: `/api/clients/assets/${encodeURIComponent(asset.id)}`,
    sha256: asset.sha256,
    ...target,
    type: asset.type,
  });
}
