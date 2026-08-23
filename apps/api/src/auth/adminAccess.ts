import type { Pool } from "mysql2/promise";

import { listAdminPermissionsForUser } from "../database.js";
import type {
  AdminAccess,
  AdminPermission,
  AdminPermissionAction,
  AdminUser,
} from "../../../shared/adminContracts.js";

const ALL_ACCESS: AdminAccess = {
  accountType: "super_admin",
  canAssignAllScreens: true,
  canAssignGroups: true,
  canAssignScreens: true,
  canManageContent: true,
  canManageGroups: true,
  canManageScreens: true,
  canManageUsers: true,
};

export async function loadAdminAccess(pool: Pool, user: AdminUser): Promise<AdminAccess> {
  if (user.isSuperAdmin) {
    return { ...ALL_ACCESS };
  }

  return resolveAdminAccess(false, await listAdminPermissionsForUser(pool, user.id));
}

export function resolveAdminAccess(
  isSuperAdmin: boolean,
  permissions: AdminPermission[],
): AdminAccess {
  if (isSuperAdmin) {
    return { ...ALL_ACCESS };
  }

  const hasAnyAction = (action: AdminPermissionAction): boolean =>
    permissions.some((permission) => permissionHasAction(permission, action));
  const assignmentPermissions = permissions.filter((permission) =>
    permissionHasAction(permission, "manage_assignments"),
  );
  const canManageGroups = hasAnyAction("manage_groups");
  const canManageScreens = hasAnyAction("manage_clients");

  return {
    accountType: canManageGroups || canManageScreens ? "admin" : "user",
    canAssignAllScreens: assignmentPermissions.some(
      (permission) => permission.targetType === "global",
    ),
    canAssignGroups: assignmentPermissions.some(
      (permission) => permission.targetType === "global" || permission.targetType === "group",
    ),
    canAssignScreens: assignmentPermissions.length > 0,
    canManageContent: hasAnyAction("manage_content"),
    canManageGroups,
    canManageScreens,
    canManageUsers: false,
  };
}

function permissionHasAction(permission: AdminPermission, action: AdminPermissionAction): boolean {
  switch (action) {
    case "manage_assignments":
      return permission.canManageAssignments;
    case "manage_clients":
      return permission.canManageClients;
    case "manage_content":
      return permission.canManageContent;
    case "manage_groups":
      return permission.canManageGroups;
    case "manage_users":
      return permission.canManageUsers;
  }
}
