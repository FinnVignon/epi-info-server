import type { ManagedClient } from "./clientContracts.js";

export interface DisplayGroup {
  createdAt: string;
  id: string;
  memberCount: number;
  name: string;
  updatedAt: string;
}

export interface DisplayGroupDetail extends DisplayGroup {
  members: ManagedClient[];
}

export interface GroupListResponse {
  capabilities: {
    canCreateGroups: boolean;
  };
  groups: DisplayGroup[];
}

export interface GroupResponse {
  group: DisplayGroupDetail;
}

export interface GroupClientOptionsResponse {
  clients: ManagedClient[];
}

export interface CreateGroupRequest {
  name: string;
}

export interface UpdateGroupRequest {
  name: string;
}
