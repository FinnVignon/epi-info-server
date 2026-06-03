export interface AdminUser {
  createdAt: string;
  displayName: string;
  email: string;
  id: string;
  isSuperAdmin: boolean;
  lastLoginAt: string | null;
  status: "active" | "disabled";
  updatedAt: string;
}

export const ADMIN_PERMISSION_ACTIONS = [
  "manage_users",
  "manage_clients",
  "manage_groups",
  "manage_content",
  "manage_assignments",
] as const;

export const ADMIN_PERMISSION_TARGET_TYPES = ["global", "group", "client"] as const;

export type AdminPermissionAction = (typeof ADMIN_PERMISSION_ACTIONS)[number];

export type AdminPermissionTargetType = (typeof ADMIN_PERMISSION_TARGET_TYPES)[number];

export type AdminPermissionTarget =
  | {
      targetId: null;
      targetType: "global";
    }
  | {
      targetId: string;
      targetType: "client" | "group";
    };

export interface AdminPermissionActions {
  canManageAssignments: boolean;
  canManageClients: boolean;
  canManageContent: boolean;
  canManageGroups: boolean;
  canManageUsers: boolean;
}

export interface AdminPermission extends AdminPermissionActions {
  createdAt: string;
  id: string;
  targetId: string | null;
  targetType: AdminPermissionTargetType;
  updatedAt: string;
  userId: string;
}

export type AdminPermissionGrant = AdminPermissionTarget & {
  actions: AdminPermissionAction[];
};

export interface AdminUserWithPermissions extends AdminUser {
  permissions: AdminPermission[];
}

export interface AdminSessionSummary {
  expiresAt: string;
  id?: string;
}

export interface AdminAuthResponse {
  session: AdminSessionSummary;
  user: AdminUser;
}

export interface BootstrapAdminRequest {
  displayName: string;
  email: string;
  password: string;
}

export interface BootstrapStatusResponse {
  needsBootstrap: boolean;
}

export interface LoginAdminRequest {
  email: string;
  password: string;
}

export interface AdminUserListResponse {
  users: AdminUserWithPermissions[];
}

export interface AdminUserResponse {
  user: AdminUserWithPermissions;
}

export interface CreateAdminUserRequest {
  displayName: string;
  email: string;
  isSuperAdmin?: boolean;
  password: string;
  permissions?: AdminPermissionGrant[];
}

export interface ReplaceAdminUserPermissionsRequest {
  permissions: AdminPermissionGrant[];
}

export interface ResetAdminUserPasswordRequest {
  password: string;
}

export interface UpdateAdminUserStatusRequest {
  status: AdminUser["status"];
}
