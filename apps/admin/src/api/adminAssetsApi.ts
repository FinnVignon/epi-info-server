import type {
  AssetListResponse,
  AssetUploadResponse,
  UpdateAssetStatusRequest,
} from "../../../shared/adminContracts";
import { readJsonResponse } from "./adminApi";

export async function listAssets(): Promise<AssetListResponse> {
  return readJsonResponse<AssetListResponse>(await fetch("/api/admin/assets"));
}

export async function uploadAsset(file: File, displayName: string): Promise<AssetUploadResponse> {
  const formData = new FormData();

  formData.append("asset", file);
  formData.append("displayName", displayName);

  return readJsonResponse<AssetUploadResponse>(
    await fetch("/api/admin/assets", {
      body: formData,
      method: "POST",
    }),
  );
}

export async function updateAssetStatus(
  assetId: string,
  request: UpdateAssetStatusRequest,
): Promise<AssetUploadResponse> {
  return readJsonResponse<AssetUploadResponse>(
    await fetch(`/api/admin/assets/${encodeURIComponent(assetId)}/status`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    }),
  );
}
