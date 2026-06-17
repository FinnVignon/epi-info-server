import type { AssignAssetRequest } from "../../../shared/adminContracts.js";
import type { AssignmentTarget } from "../database.js";
import type { ClientLiveUpdateHub } from "../live/clientLiveUpdateHub.js";

export function readAssignmentBody(body: Partial<AssignAssetRequest>): AssignAssetRequest | string {
  if (typeof body.assetId !== "string" || body.assetId.trim().length === 0) {
    return "Asset id is required";
  }

  if (body.fit !== "contain" && body.fit !== "cover") {
    return "Fit must be contain or cover";
  }

  return {
    assetId: body.assetId.trim(),
    fit: body.fit,
  };
}

export function notifyAssignmentChanged(
  liveUpdates: ClientLiveUpdateHub,
  target: AssignmentTarget,
): void {
  void liveUpdates.notifyAssignmentChanged(target).catch((error: unknown) => {
    console.warn(
      `Unable to notify live clients about assignment change: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  });
}
