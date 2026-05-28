export const ADMIN_PERMISSION_ACTIONS = [
  "manage_users",
  "manage_clients",
  "manage_groups",
  "manage_content",
  "manage_assignments",
] as const;

export const ADMIN_PERMISSION_SCOPES = ["global", "group", "client"] as const;

export type AdminPermissionAction = (typeof ADMIN_PERMISSION_ACTIONS)[number];

export type AdminPermissionScope = (typeof ADMIN_PERMISSION_SCOPES)[number];

export interface AdminUserSession {
  expiresAt: string;
  id: string;
  user: {
    displayName: string;
    email: string;
    id: string;
    isSuperAdmin: boolean;
    status: "active" | "disabled";
  };
}

export interface AdminPermissionGrant {
  actions: AdminPermissionAction[];
  scope: AdminPermissionScope;
  targetId: string | null;
}
