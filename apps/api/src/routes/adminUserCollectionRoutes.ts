import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "mysql2/promise";

import { hashAdminPassword } from "../auth/passwords.js";
import type { ServerConfig } from "../config.js";
import {
  createAdminUser,
  isDuplicateEntryError,
  listAdminUsers,
  replaceAdminPermissionsForUser,
} from "../database.js";
import { loadAdminUserWithPermissions } from "../services/adminUserDetails.js";
import type { CreateAdminUserRequest } from "../../../shared/adminContracts.js";
import { createPermissionInputs } from "./adminUserPermissionParsers.js";
import { readCreateUserBody } from "./adminUserRequestParsers.js";

export function createAdminUserCollectionRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();

  router.get("/", async (_request, response, next) => {
    try {
      const users = await Promise.all(
        (await listAdminUsers(pool)).map((user) => loadAdminUserWithPermissions(pool, user)),
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
        user: await loadAdminUserWithPermissions(pool, user),
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        response.status(409).json({ error: "An admin user with this email already exists" });
        return;
      }

      next(error);
    }
  });

  return router;
}
