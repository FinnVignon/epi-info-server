import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Pool } from "mysql2/promise";

import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { createRequireSuperAdminMiddleware } from "../auth/adminPermissions.js";
import { hashAdminPassword } from "../auth/passwords.js";
import { ServerConfig } from "../config.js";
import {
  createAdminUser,
  deleteAdminSessionsForUser,
  findAdminUserById,
  isDuplicateEntryError,
  listAdminPermissionsForUser,
  listAdminUsers,
  replaceAdminPermissionsForUser,
  updateAdminUserPasswordHash,
  updateAdminUserProfile,
  updateAdminUserStatus,
} from "../database.js";
import type {
  AdminUser,
  AdminUserWithPermissions,
  CreateAdminUserRequest,
  ReplaceAdminUserPermissionsRequest,
  ResetAdminUserPasswordRequest,
  UpdateAdminUserProfileRequest,
  UpdateAdminUserStatusRequest,
} from "../../../shared/adminContracts.js";
import {
  createPermissionInputs,
  readCreateUserBody,
  readPasswordBody,
  readPermissionsBody,
  readProfileBody,
  readStatusBody,
  readUserId,
} from "./adminUserRequestParsers.js";
import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";

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
        isSuperAdmin: false,
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
      if (isDuplicateEntryError(error)) {
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
