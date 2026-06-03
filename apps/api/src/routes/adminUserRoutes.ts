import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Pool } from "mysql2/promise";

import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { createRequireSuperAdminMiddleware } from "../auth/adminPermissions.js";
import { hashAdminPassword, isValidAdminPassword } from "../auth/passwords.js";
import { ServerConfig } from "../config.js";
import {
  createAdminUser,
  deleteAdminSessionsForUser,
  findAdminUserById,
  listAdminPermissionsForUser,
  listAdminUsers,
  replaceAdminPermissionsForUser,
  updateAdminUserPasswordHash,
  updateAdminUserProfile,
  updateAdminUserStatus,
} from "../database.js";
import type { CreateAdminPermissionInput } from "../database.js";
import type {
  AdminPermissionAction,
  AdminPermissionActions,
  AdminPermissionGrant,
  AdminPermissionTarget,
  AdminUser,
  AdminUserWithPermissions,
  CreateAdminUserRequest,
  ReplaceAdminUserPermissionsRequest,
  ResetAdminUserPasswordRequest,
  UpdateAdminUserProfileRequest,
  UpdateAdminUserStatusRequest,
} from "../../../shared/adminContracts.js";
import {
  ADMIN_PERMISSION_ACTIONS,
  ADMIN_PERMISSION_TARGET_TYPES,
} from "../../../shared/adminContracts.js";
import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";

interface UserRouteParams {
  userId?: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readUserId(params: UserRouteParams): string | null {
  return typeof params.userId === "string" && params.userId.length > 0 ? params.userId : null;
}

function readCreateUserBody(
  body: Partial<CreateAdminUserRequest>,
): CreateAdminUserRequest | string {
  if (
    typeof body.displayName !== "string" ||
    typeof body.email !== "string" ||
    typeof body.password !== "string"
  ) {
    return "Display name, email, and password are required";
  }

  const displayName = body.displayName.trim();
  const email = normalizeEmail(body.email);

  if (displayName.length < 2) {
    return "Display name must be at least 2 characters";
  }

  if (!isValidEmail(email)) {
    return "A valid email is required";
  }

  if (!isValidAdminPassword(body.password)) {
    return "Password must be at least 10 characters";
  }

  if (body.isSuperAdmin !== undefined && typeof body.isSuperAdmin !== "boolean") {
    return "isSuperAdmin must be a boolean";
  }

  const permissions = readPermissionGrants(body.permissions ?? []);

  if (typeof permissions === "string") {
    return permissions;
  }

  return {
    displayName,
    email,
    isSuperAdmin: body.isSuperAdmin ?? false,
    password: body.password,
    permissions,
  };
}

function readPasswordBody(
  body: Partial<ResetAdminUserPasswordRequest>,
): { password: string } | string {
  if (typeof body.password !== "string") {
    return "Password is required";
  }

  if (!isValidAdminPassword(body.password)) {
    return "Password must be at least 10 characters";
  }

  return {
    password: body.password,
  };
}

function readProfileBody(
  body: Partial<UpdateAdminUserProfileRequest>,
): { displayName: string } | string {
  if (typeof body.displayName !== "string") {
    return "Display name is required";
  }

  const displayName = body.displayName.trim();

  if (displayName.length < 2) {
    return "Display name must be at least 2 characters";
  }

  return {
    displayName,
  };
}

function readPermissionsBody(
  body: Partial<ReplaceAdminUserPermissionsRequest>,
): AdminPermissionGrant[] | string {
  return readPermissionGrants(body.permissions);
}

function readPermissionGrants(value: unknown): AdminPermissionGrant[] | string {
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

  return {
    ...target,
    actions: [...actions],
  };
}

function readPermissionTarget(
  value: Partial<AdminPermissionGrant>,
): AdminPermissionTarget | string {
  if (!isAdminPermissionTargetType(value.targetType)) {
    return "Permission target type is invalid";
  }

  if (value.targetType === "global") {
    return {
      targetId: null,
      targetType: "global",
    };
  }

  if (typeof value.targetId !== "string" || value.targetId.length === 0) {
    return "Permission target id is required";
  }

  return {
    targetId: value.targetId,
    targetType: value.targetType,
  };
}

function readStatusBody(
  body: Partial<UpdateAdminUserStatusRequest>,
): { status: AdminUser["status"] } | string {
  if (body.status !== "active" && body.status !== "disabled") {
    return "Status must be active or disabled";
  }

  return {
    status: body.status,
  };
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

function createPermissionInputs(
  userId: string,
  grants: AdminPermissionGrant[],
): CreateAdminPermissionInput[] {
  return grants.map((grant) => ({
    ...permissionActionsFromGrant(grant),
    id: randomUUID(),
    target:
      grant.targetType === "global"
        ? {
            targetId: null,
            targetType: "global",
          }
        : {
            targetId: grant.targetId,
            targetType: grant.targetType,
          },
    userId,
  }));
}

async function loadUserWithPermissions(
  pool: Pool,
  user: AdminUser,
): Promise<AdminUserWithPermissions> {
  return {
    ...user,
    permissions: await listAdminPermissionsForUser(pool, user.id),
  };
}

async function findUserWithPermissions(
  pool: Pool,
  userId: string,
): Promise<AdminUserWithPermissions | null> {
  const user = await findAdminUserById(pool, userId);

  return user ? loadUserWithPermissions(pool, user) : null;
}

function isDuplicateEmailError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY"
  );
}

export function createAdminUserRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireAdminAuth = createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName);
  const requireSuperAdmin = createRequireSuperAdminMiddleware();

  router.use(requireAdminAuth, requireSuperAdmin);

  router.get("/", async (_request, response, next) => {
    try {
      const users = await Promise.all(
        (await listAdminUsers(pool)).map((user) => loadUserWithPermissions(pool, user)),
      );

      response.json({ users });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const body = readCreateUserBody((request.body ?? {}) as Partial<CreateAdminUserRequest>);

      if (typeof body === "string") {
        response.status(400).json({ error: body });
        return;
      }

      const user = await createAdminUser(pool, {
        displayName: body.displayName,
        email: body.email,
        id: randomUUID(),
        isSuperAdmin: body.isSuperAdmin ?? false,
        passwordHash: await hashAdminPassword(body.password, {
          bcryptRounds: config.adminAuth.passwordBcryptRounds,
        }),
      });

      await replaceAdminPermissionsForUser(
        pool,
        user.id,
        createPermissionInputs(user.id, body.permissions ?? []),
      );
      response.status(201).json({
        user: await loadUserWithPermissions(pool, user),
      });
    } catch (error) {
      if (isDuplicateEmailError(error)) {
        response.status(409).json({ error: "An admin user with this email already exists" });
        return;
      }

      next(error);
    }
  });

  router.get("/:userId", async (request, response, next) => {
    try {
      const userId = readUserId(request.params);

      if (!userId) {
        response.status(400).json({ error: "User id is required" });
        return;
      }

      const user = await findUserWithPermissions(pool, userId);

      if (!user) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:userId/profile", async (request, response, next) => {
    try {
      const userId = readUserId(request.params);
      const profile = readProfileBody(
        (request.body ?? {}) as Partial<UpdateAdminUserProfileRequest>,
      );

      if (!userId) {
        response.status(400).json({ error: "User id is required" });
        return;
      }

      if (typeof profile === "string") {
        response.status(400).json({ error: profile });
        return;
      }

      if (!(await findAdminUserById(pool, userId))) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      await updateAdminUserProfile(pool, {
        displayName: profile.displayName,
        userId,
      });
      const user = await findUserWithPermissions(pool, userId);

      if (!user) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:userId/status", async (request, response, next) => {
    try {
      const userId = readUserId(request.params);
      const status = readStatusBody((request.body ?? {}) as Partial<UpdateAdminUserStatusRequest>);

      if (!userId) {
        response.status(400).json({ error: "User id is required" });
        return;
      }

      if (typeof status === "string") {
        response.status(400).json({ error: status });
        return;
      }

      const adminRequest = request as unknown as AuthenticatedAdminRequest;

      if (userId === adminRequest.adminSession.user.id && status.status === "disabled") {
        response.status(400).json({ error: "You cannot disable your own admin user" });
        return;
      }

      if (!(await findAdminUserById(pool, userId))) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      await updateAdminUserStatus(pool, { status: status.status, userId });
      await deleteAdminSessionsForUser(pool, userId);
      const user = await findUserWithPermissions(pool, userId);

      if (!user) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      response.json({
        user,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:userId/password", async (request, response, next) => {
    try {
      const userId = readUserId(request.params);
      const password = readPasswordBody(
        (request.body ?? {}) as Partial<ResetAdminUserPasswordRequest>,
      );

      if (!userId) {
        response.status(400).json({ error: "User id is required" });
        return;
      }

      if (typeof password === "string") {
        response.status(400).json({ error: password });
        return;
      }

      const updated = await updateAdminUserPasswordHash(
        pool,
        userId,
        await hashAdminPassword(password.password, {
          bcryptRounds: config.adminAuth.passwordBcryptRounds,
        }),
      );

      if (!updated) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      await deleteAdminSessionsForUser(pool, userId);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.put("/:userId/permissions", async (request, response, next) => {
    try {
      const userId = readUserId(request.params);
      const permissions = readPermissionsBody(
        (request.body ?? {}) as Partial<ReplaceAdminUserPermissionsRequest>,
      );

      if (!userId) {
        response.status(400).json({ error: "User id is required" });
        return;
      }

      if (typeof permissions === "string") {
        response.status(400).json({ error: permissions });
        return;
      }

      if (!(await findAdminUserById(pool, userId))) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      await replaceAdminPermissionsForUser(
        pool,
        userId,
        createPermissionInputs(userId, permissions),
      );
      const user = await findUserWithPermissions(pool, userId);

      if (!user) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      response.json({
        user,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
