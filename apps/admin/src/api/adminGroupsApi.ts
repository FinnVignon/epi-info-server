import type {
  CreateGroupRequest,
  GroupClientOptionsResponse,
  GroupListResponse,
  GroupResponse,
  UpdateGroupRequest,
} from "../../../shared/groupContracts";
import { readJsonResponse } from "./adminApi";

export async function listGroups(): Promise<GroupListResponse> {
  return readJsonResponse<GroupListResponse>(await fetch("/api/admin/groups"));
}

export async function getGroup(groupId: string): Promise<GroupResponse> {
  return readJsonResponse<GroupResponse>(
    await fetch(`/api/admin/groups/${encodeURIComponent(groupId)}`),
  );
}

export async function listGroupClientOptions(groupId: string): Promise<GroupClientOptionsResponse> {
  return readJsonResponse<GroupClientOptionsResponse>(
    await fetch(`/api/admin/groups/${encodeURIComponent(groupId)}/client-options`),
  );
}

export async function createGroup(request: CreateGroupRequest): Promise<GroupResponse> {
  return readJsonResponse<GroupResponse>(
    await fetch("/api/admin/groups", {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    }),
  );
}

export async function updateGroup(
  groupId: string,
  request: UpdateGroupRequest,
): Promise<GroupResponse> {
  return readJsonResponse<GroupResponse>(
    await fetch(`/api/admin/groups/${encodeURIComponent(groupId)}`, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PATCH",
    }),
  );
}

export async function deleteGroup(groupId: string): Promise<void> {
  await readJsonResponse<void>(
    await fetch(`/api/admin/groups/${encodeURIComponent(groupId)}`, {
      method: "DELETE",
    }),
  );
}

export async function addGroupMember(groupId: string, clientId: string): Promise<GroupResponse> {
  return readJsonResponse<GroupResponse>(
    await fetch(
      `/api/admin/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(clientId)}`,
      {
        method: "PUT",
      },
    ),
  );
}

export async function removeGroupMember(groupId: string, clientId: string): Promise<GroupResponse> {
  return readJsonResponse<GroupResponse>(
    await fetch(
      `/api/admin/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(clientId)}`,
      {
        method: "DELETE",
      },
    ),
  );
}
