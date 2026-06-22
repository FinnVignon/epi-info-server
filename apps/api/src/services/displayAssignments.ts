import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";

import type { AssignDisplayContentRequest } from "../../../shared/adminContracts.js";
import type { Manifest } from "../../../shared/contracts.js";
import {
  assignAssetToTarget,
  assignManifestItemToTarget,
  findAssetById,
  type AssignmentTarget,
} from "../database.js";

const SINGLE_ITEM_DURATION_SECONDS = 30;

export async function assignDisplayContentToTarget(
  pool: Pool,
  assignment: AssignDisplayContentRequest,
  target: AssignmentTarget,
): Promise<Manifest | null> {
  if (assignment.contentType === "live_web_link") {
    return assignLiveWebLinkToTarget(pool, assignment, target);
  }

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

async function assignLiveWebLinkToTarget(
  pool: Pool,
  assignment: Extract<AssignDisplayContentRequest, { contentType: "live_web_link" }>,
  target: AssignmentTarget,
): Promise<Manifest> {
  const itemId = randomUUID();

  return assignManifestItemToTarget(pool, {
    assignmentId: randomUUID(),
    item: {
      durationSeconds: SINGLE_ITEM_DURATION_SECONDS,
      id: itemId,
      refreshSeconds: assignment.refreshSeconds,
      type: "live_web_link",
      url: assignment.url,
    },
    manifestId: randomUUID(),
    manifestName: createLiveWebLinkManifestName(assignment.url),
    ...target,
  });
}

function createLiveWebLinkManifestName(url: string): string {
  try {
    const parsedUrl = new URL(url);

    return `Live web link: ${parsedUrl.hostname}`.slice(0, 255);
  } catch {
    return "Live web link";
  }
}
