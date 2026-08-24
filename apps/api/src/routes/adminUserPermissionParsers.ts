import { randomUUID } from "node:crypto";

import type { CreateAdminPermissionInput } from "../database.js";
import type {
  AdminPermissionAction,
  AdminPermissionActions,
  AdminPermissionGrant,
  AdminPermissionTarget,
  CreateAdminUserRequest,
  ReplaceAdminUserPermissionsRequest,
} from "../../../shared/adminContracts.js";
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_TARGET_TYPES,
} from "../../../shared/adminContracts.js";

export function readAccountTypePermissionError(
  accountType: CreateAdminUserRequest["accountType"],
  permissions: AdminPermissionGrant[],
): string | null {
  const actions = new Set(permissions.flatMap((permission) => permission.actions));

  if (actions.has("manage_users")) {
    return "Only the super admin can manage users";
  }

  if (accountType === "user") {
    if (actions.has("manage_clients") || actions.has("manage_groups")) {
      return "User accounts cannot receive screen or group management permissions";
    }

    if (!actions.has("manage_content") || !actions.has("manage_assignments")) {
      return "User accounts require content and assignment permissions";
    }

    return null;
  }

  return actions.has("manage_clients") || actions.has("manage_groups")
    ? null
    : "Admin accounts require screen or group management permission";
}

export function readPermissionsBody(
  body: Partial<ReplaceAdminUserPermissionsRequest>,
): AdminPermissionGrant[] | string {
  return readPermissionGrants(body.permissions);
}

export function readPermissionGrants(value: unknown): AdminPermissionGrant[] | string {
  if (!Array.isArray(value)) {
    return "Permissions must be an array";
  }

  const grants: AdminPermissionGrant[] = [];
  const targets = new Set<string>();

  for (const rawGrant of value) {
    const grant = readPermissionGrant(rawGrant);

    if (typeof grant === "string") {
      return grant;
    }

    const targetKey = `${grant.targetType}:${grant.targetId ?? "global"}`;

    if (targets.has(targetKey)) {
      return "Permission targets must be unique";
    }

    targets.add(targetKey);
    grants.push(grant);
  }

  return grants;
}

export function createPermissionInputs(
  userId: string,
  grants: AdminPermissionGrant[],
): CreateAdminPermissionInput[] {
  return grants.map((grant) => ({
    ...permissionActionsFromGrant(grant),
    id: randomUUID(),
    target:
      grant.targetType === "global"
        ? { targetId: null, targetType: "global" }
        : { targetId: grant.targetId, targetType: grant.targetType },
    userId,
  }));
}

function readPermissionGrant(value: unknown): AdminPermissionGrant | string {
  if (typeof value !== "object" || value === null) {
    return "Each permission must be an object";
  }

  const rawGrant = value as Partial<AdminPermissionGrant>;
  const target = readPermissionTarget(rawGrant);

  if (typeof target === "string") {
    return target;
  }

  if (!Array.isArray(rawGrant.actions) || rawGrant.actions.length === 0) {
    return "Each permission must include at least one action";
  }

  const actions = new Set<AdminPermissionAction>();

  for (const action of rawGrant.actions) {
    if (!isAdminPermissionAction(action)) {
      return "Permission action is invalid";
    }

    actions.add(action);
  }

  return { ...target, actions: [...actions] };
}

function readPermissionTarget(
  value: Partial<AdminPermissionGrant>,
): AdminPermissionTarget | string {
  if (!isAdminPermissionTargetType(value.targetType)) {
    return "Permission target type is invalid";
  }

  if (value.targetType === "global") {
    return { targetId: null, targetType: "global" };
  }

  if (typeof value.targetId !== "string" || value.targetId.length === 0) {
    return "Permission target id is required";
  }

  return { targetId: value.targetId, targetType: value.targetType };
}

function isAdminPermissionAction(action: unknown): action is AdminPermissionAction {
  return (
    typeof action === "string" && (ADMIN_PERMISSION_ACTIONS as readonly string[]).includes(action)
  );
}

function isAdminPermissionTargetType(
  targetType: unknown,
): targetType is AdminPermissionTarget["targetType"] {
  return (
    typeof targetType === "string" &&
    (ADMIN_PERMISSION_TARGET_TYPES as readonly string[]).includes(targetType)
  );
}

function permissionActionsFromGrant(grant: AdminPermissionGrant): AdminPermissionActions {
  const actions = new Set(grant.actions);

  return {
    canManageAssignments: actions.has("manage_assignments"),
    canManageClients: actions.has("manage_clients"),
    canManageContent: actions.has("manage_content"),
    canManageGroups: actions.has("manage_groups"),
    canManageUsers: actions.has("manage_users"),
  };
}
