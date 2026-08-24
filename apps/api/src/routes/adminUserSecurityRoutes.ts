import { Router } from "express";
import type { Pool } from "mysql2/promise";

import { hashAdminPassword } from "../auth/passwords.js";
import type { ServerConfig } from "../config.js";
import {
  deleteAdminSessionsForUser,
  findAdminUserById,
  replaceAdminPermissionsForUser,
  updateAdminUserPasswordHash,
} from "../database.js";
import { findAdminUserWithPermissions } from "../services/adminUserDetails.js";
import type {
  ReplaceAdminUserPermissionsRequest,
  ResetAdminUserPasswordRequest,
} from "../../../shared/adminContracts.js";
import { createPermissionInputs, readPermissionsBody } from "./adminUserPermissionParsers.js";
import { readPasswordBody, readUserId } from "./adminUserRequestParsers.js";

export function createAdminUserSecurityRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();

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
      const user = await findAdminUserWithPermissions(pool, userId);

      if (!user) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
