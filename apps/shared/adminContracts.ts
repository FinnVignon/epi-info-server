import type { FitMode, Manifest } from "./contracts.js";
import type { ManagedClient } from "./clientContracts.js";
import type { DisplayGroup } from "./groupContracts.js";

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

export type AdminAccountType = "admin" | "super_admin" | "user";

export interface AdminAccess {
  accountType: AdminAccountType;
  canAssignAllScreens: boolean;
  canAssignGroups: boolean;
  canAssignScreens: boolean;
  canManageContent: boolean;
  canManageGroups: boolean;
  canManageScreens: boolean;
  canManageUsers: boolean;
}

export type AssetType = "image" | "video";
export type AssetStatus = "active" | "archived";

export interface AssetUploader {
  displayName: string;
  email: string;
  id: string;
}

export interface Asset {
  archivedAt: string | null;
  createdAt: string;
  displayName: string;
  id: string;
  mimeType: string;
  originalFilename: string;
  publicUrl: string;
  sha256: string;
  sizeBytes: number;
  status: AssetStatus;
  type: AssetType;
  updatedAt: string;
  uploadedBy: AssetUploader | null;
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
  access: AdminAccess;
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

export interface AssetListResponse {
  assets: Asset[];
}

export interface AssetUploadResponse {
  asset: Asset;
}

export interface UpdateAssetStatusRequest {
  status: AssetStatus;
}

export interface AssignAssetRequest {
  assetId: string;
  contentType: "asset";
  fit: FitMode;
}

export interface AssignLiveWebLinkRequest {
  contentType: "live_web_link";
  refreshSeconds: number;
  url: string;
}

export type AssignDisplayContentRequest = AssignAssetRequest | AssignLiveWebLinkRequest;

export interface AssignmentResponse {
  manifest: Manifest;
}

export interface AssignmentClientListResponse {
  clients: ManagedClient[];
}

export interface AssignmentGroupListResponse {
  groups: DisplayGroup[];
}

export interface AssignmentGlobalTargetResponse {
  target: {
    id: "global";
    name: string;
  };
}

export interface CreateAdminUserRequest {
  accountType: Exclude<AdminAccountType, "super_admin">;
  displayName: string;
  email: string;
  password: string;
  permissions?: AdminPermissionGrant[];
}

export interface ReplaceAdminUserPermissionsRequest {
  permissions: AdminPermissionGrant[];
}

export interface ResetAdminUserPasswordRequest {
  password: string;
}

export interface UpdateAdminUserProfileRequest {
  displayName: string;
}

export interface UpdateAdminUserStatusRequest {
  status: AdminUser["status"];
}
