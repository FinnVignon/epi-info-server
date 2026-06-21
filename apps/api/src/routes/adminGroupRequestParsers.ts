import type { CreateGroupRequest, UpdateGroupRequest } from "../../../shared/groupContracts.js";

export interface GroupRouteParams {
  clientId?: string;
  groupId?: string;
}

export function readRouteId(params: GroupRouteParams, key: keyof GroupRouteParams): string | null {
  const value = params[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

export function readMembershipRouteIds(
  params: GroupRouteParams,
): { clientId: string; groupId: string } | null {
  const clientId = readRouteId(params, "clientId");
  const groupId = readRouteId(params, "groupId");

  return clientId && groupId ? { clientId, groupId } : null;
}

export function readGroupName(
  body: Partial<CreateGroupRequest | UpdateGroupRequest>,
): string | { error: string } {
  if (typeof body.name !== "string") {
    return { error: "Group name is required" };
  }

  const name = body.name.trim();

  if (name.length < 2) {
    return { error: "Group name must be at least 2 characters" };
  }

  if (name.length > 255) {
    return { error: "Group name must not exceed 255 characters" };
  }

  return name;
}
