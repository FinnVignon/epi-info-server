import type { AssetStatus, UpdateAssetStatusRequest } from "../../../shared/adminContracts.js";

export function readAssetStatusBody(body: Partial<UpdateAssetStatusRequest>): AssetStatus | null {
  return body.status === "active" || body.status === "archived" ? body.status : null;
}
