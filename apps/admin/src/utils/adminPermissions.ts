import type {
  AdminPermission,
  AdminPermissionAction,
  AdminPermissionGrant,
  AdminPermissionTarget,
} from "../../../shared/adminContracts";

export function permissionToGrant(permission: AdminPermission): AdminPermissionGrant {
  const actions: AdminPermissionAction[] = [];

  if (permission.canManageAssignments) {
    actions.push("manage_assignments");
  }

  if (permission.canManageClients) {
    actions.push("manage_clients");
  }

  if (permission.canManageContent) {
    actions.push("manage_content");
  }

  if (permission.canManageGroups) {
    actions.push("manage_groups");
  }

  if (permission.canManageUsers) {
    actions.push("manage_users");
  }

  const target: AdminPermissionTarget =
    permission.targetType === "global"
      ? {
          targetId: null,
          targetType: "global",
        }
      : {
          targetId: permission.targetId ?? "",
          targetType: permission.targetType,
        };

  return {
    ...target,
    actions,
  };
}
