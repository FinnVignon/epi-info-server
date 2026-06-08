import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { createClientSecret, hashClientCredential } from "../auth/clientCredentials.js";
import {
  createRequireAdminPermissionMiddleware,
  fixedAdminPermissionTarget,
} from "../auth/adminPermissions.js";
import type { ServerConfig } from "../config.js";
import { createClientEnrollmentToken } from "../database.js";
import type { CreateClientEnrollmentTokenResponse } from "../../../shared/clientContracts.js";

export function createAdminClientEnrollmentRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();

  router.use(createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName));
  router.use(
    createRequireAdminPermissionMiddleware(
      pool,
      "manage_clients",
      fixedAdminPermissionTarget({
        targetId: null,
        targetType: "global",
      }),
    ),
  );

  router.post("/", async (request, response, next) => {
    try {
      const adminRequest = request as AuthenticatedAdminRequest;
      const token = createClientSecret();
      const expiresAt = new Date(
        Date.now() + config.clientAuth.enrollmentTokenTtlMinutes * 60 * 1000,
      );

      await createClientEnrollmentToken(pool, {
        createdByUserId: adminRequest.adminSession.user.id,
        expiresAt,
        id: randomUUID(),
        tokenHash: hashClientCredential(token),
      });

      response.setHeader("Cache-Control", "no-store");
      response.status(201).json({
        enrollmentToken: {
          expiresAt: expiresAt.toISOString(),
          token,
        },
      } satisfies CreateClientEnrollmentTokenResponse);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
