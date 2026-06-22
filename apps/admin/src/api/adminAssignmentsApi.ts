import type {
  AssetListResponse,
  AssignDisplayContentRequest,
  AssignmentGroupListResponse,
  AssignmentGlobalTargetResponse,
  AssignmentResponse,
  AssignmentClientListResponse,
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

export async function listAssignmentGroups(): Promise<AssignmentGroupListResponse> {
  return readJsonResponse<AssignmentGroupListResponse>(
    await fetch("/api/admin/assignments/groups"),
  );
}

export async function assignContentToClient(
  clientId: string,
  request: AssignDisplayContentRequest,
): Promise<AssignmentResponse> {
  return readJsonResponse<AssignmentResponse>(
    await fetch(`/api/admin/assignments/clients/${encodeURIComponent(clientId)}`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    }),
  );
}

export async function assignContentToGroup(
  groupId: string,
  request: AssignDisplayContentRequest,
): Promise<AssignmentResponse> {
  return readJsonResponse<AssignmentResponse>(
    await fetch(`/api/admin/assignments/groups/${encodeURIComponent(groupId)}`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    }),
  );
}

export async function getGlobalAssignmentTarget(): Promise<AssignmentGlobalTargetResponse> {
  return readJsonResponse<AssignmentGlobalTargetResponse>(
    await fetch("/api/admin/assignments/global"),
  );
}

export async function assignContentGlobally(
  _targetId: string,
  request: AssignDisplayContentRequest,
): Promise<AssignmentResponse> {
  return readJsonResponse<AssignmentResponse>(
    await fetch("/api/admin/assignments/global", {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    }),
  );
}
