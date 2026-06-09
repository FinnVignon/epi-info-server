import type {
  AssetListResponse,
  AssignAssetToClientRequest,
  AssignmentClientListResponse,
  ClientAssignmentResponse,
} from "../../../shared/adminContracts";
import { readJsonResponse } from "./adminApi";

export async function listAssignmentAssets(): Promise<AssetListResponse> {
  return readJsonResponse<AssetListResponse>(await fetch("/api/admin/assignments/assets"));
}

export async function listAssignmentClients(): Promise<AssignmentClientListResponse> {
  return readJsonResponse<AssignmentClientListResponse>(
    await fetch("/api/admin/assignments/clients"),
  );
}

export async function assignAssetToClient(
  clientId: string,
  request: AssignAssetToClientRequest,
): Promise<ClientAssignmentResponse> {
  return readJsonResponse<ClientAssignmentResponse>(
    await fetch(`/api/admin/assignments/clients/${encodeURIComponent(clientId)}`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    }),
  );
}
