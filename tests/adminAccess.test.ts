import { describe, expect, it } from "vitest";

import { resolveAdminAccess } from "../apps/api/src/auth/adminAccess.js";
import { readCreateUserBody } from "../apps/api/src/routes/adminUserRequestParsers.js";
import type {
  AdminPermission,
  AdminPermissionAction,
  AdminPermissionTargetType,
  CreateAdminUserRequest,
} from "../apps/shared/adminContracts.js";

describe("admin interface access", () => {
  it("gives super admins unrestricted access", () => {
    expect(resolveAdminAccess(true, [])).toEqual({
      accountType: "super_admin",
      canAssignAllScreens: true,
      canAssignGroups: true,
      canAssignScreens: true,
      canManageContent: true,
      canManageGroups: true,
      canManageScreens: true,
      canManageUsers: true,
    });
  });

  it("keeps content operators out of setup navigation", () => {
    const access = resolveAdminAccess(false, [
      createPermission("group", "group-1", ["manage_content", "manage_assignments"]),
    ]);

    expect(access).toMatchObject({
      accountType: "user",
      canAssignAllScreens: false,
      canAssignGroups: true,
      canAssignScreens: true,
      canManageContent: true,
      canManageGroups: false,
      canManageScreens: false,
      canManageUsers: false,
    });
  });

  it("classifies screen or group managers as admins", () => {
    const access = resolveAdminAccess(false, [
      createPermission("global", null, ["manage_clients", "manage_groups"]),
    ]);

    expect(access).toMatchObject({
      accountType: "admin",
      canManageGroups: true,
      canManageScreens: true,
      canManageUsers: false,
    });
  });

  it("exposes only assignment scopes covered by grants", () => {
    const screenAccess = resolveAdminAccess(false, [
      createPermission("client", "screen-1", ["manage_assignments"]),
    ]);
    const globalAccess = resolveAdminAccess(false, [
      createPermission("global", null, ["manage_assignments"]),
    ]);

    expect(screenAccess).toMatchObject({
      canAssignAllScreens: false,
      canAssignGroups: false,
      canAssignScreens: true,
    });
    expect(globalAccess).toMatchObject({
      canAssignAllScreens: true,
      canAssignGroups: true,
      canAssignScreens: true,
    });
  });

  it("accepts content operators with content and assignment grants", () => {
    expect(
      readCreateUserBody({
        accountType: "user",
        displayName: "Content operator",
        email: "operator@example.com",
        password: "testing12345",
        permissions: [
          {
            actions: ["manage_content", "manage_assignments"],
            targetId: "group-1",
            targetType: "group",
          },
        ],
      }),
    ).not.toBeTypeOf("string");
  });

  it("rejects setup permissions for user accounts", () => {
    expect(
      readCreateUserBody({
        accountType: "user",
        displayName: "Content operator",
        email: "operator@example.com",
        password: "testing12345",
        permissions: [
          {
            actions: ["manage_clients", "manage_content", "manage_assignments"],
            targetId: null,
            targetType: "global",
          },
        ],
      }),
    ).toBe("User accounts cannot receive screen or group management permissions");
  });

  it("requires setup permission for admin accounts", () => {
    expect(
      readCreateUserBody({
        accountType: "admin",
        displayName: "Setup admin",
        email: "setup@example.com",
        password: "testing12345",
        permissions: [
          {
            actions: ["manage_content", "manage_assignments"],
            targetId: null,
            targetType: "global",
          },
        ],
      }),
    ).toBe("Admin accounts require screen or group management permission");
  });

  it("does not allow normal user creation to request super-admin access", () => {
    expect(
      readCreateUserBody({
        accountType: "super_admin",
        displayName: "Second owner",
        email: "owner-2@example.com",
        password: "testing12345",
        permissions: [],
      } as unknown as Partial<CreateAdminUserRequest>),
    ).toBe("Account type, display name, email, and password are required");
  });
});

function createPermission(
  targetType: AdminPermissionTargetType,
  targetId: string | null,
  actions: AdminPermissionAction[],
): AdminPermission {
  return {
    canManageAssignments: actions.includes("manage_assignments"),
    canManageClients: actions.includes("manage_clients"),
    canManageContent: actions.includes("manage_content"),
    canManageGroups: actions.includes("manage_groups"),
    canManageUsers: actions.includes("manage_users"),
    createdAt: "2026-01-01T00:00:00.000Z",
    id: "permission-1",
    targetId,
    targetType,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userId: "user-1",
  };
}
