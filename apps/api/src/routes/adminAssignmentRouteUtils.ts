import type { AssignAssetRequest } from "../../../shared/adminContracts.js";

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
