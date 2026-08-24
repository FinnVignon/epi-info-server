import type {
  AdminAccountType,
  AdminPermissionAction,
  AdminUserWithPermissions,
} from "../../../shared/adminContracts";

const USER_ACTIONS: AdminPermissionAction[] = ["manage_content", "manage_assignments"];
const ADMIN_ACTIONS: AdminPermissionAction[] = [
  "manage_clients",
  "manage_groups",
  "manage_content",
  "manage_assignments",
];

export function getAdminUserAccountType(user: AdminUserWithPermissions): AdminAccountType {
  if (user.isSuperAdmin) {
    return "super_admin";
  }

  const hasSetupPermission = user.permissions.some(
    (permission) =>
      permission.canManageClients || permission.canManageGroups || permission.canManageUsers,
  );

  return hasSetupPermission ? "admin" : "user";
}

export function getAccountTypeActions(accountType: AdminAccountType): AdminPermissionAction[] {
  if (accountType === "super_admin") {
    return [];
  }

  return accountType === "admin" ? ADMIN_ACTIONS : USER_ACTIONS;
}
