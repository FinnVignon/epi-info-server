export {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_TARGET_TYPES as ADMIN_PERMISSION_SCOPES,
} from "../../../shared/adminContracts.js";

export type {
  AdminPermissionAction,
  AdminPermissionGrant,
  AdminPermissionTargetType as AdminPermissionScope,
} from "../../../shared/adminContracts.js";

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
