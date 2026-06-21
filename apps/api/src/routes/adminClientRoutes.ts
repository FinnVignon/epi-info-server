import { Router } from "express";
import type { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import {
  createRequireAdminPermissionMiddleware,
  createRequireAnyAdminPermissionMiddleware,
} from "../auth/adminPermissions.js";
import type { ServerConfig } from "../config.js";
import {
  adminUserHasPermission,
  listClientsForAdmin,
  updateClientProfile,
  updateClientStatus,
} from "../database.js";
import { loadClientDetail, requireClientDetail } from "../services/clientDetails.js";
import type { ClientListResponse, ClientResponse } from "../../../shared/clientContracts.js";
import { readClientId, readClientName, readClientStatus } from "./adminClientRequestParsers.js";

export function createAdminClientRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireAdminAuth = createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName);
  const requireAnyClientPermission = createRequireAnyAdminPermissionMiddleware(
    pool,
    "manage_clients",
  );
  const requireClientPermission = createRequireAdminPermissionMiddleware(
    pool,
    "manage_clients",
    (request) => ({
      targetId: readClientId(request.params) ?? "",
      targetType: "client",
    }),
  );

  router.use(requireAdminAuth);

  router.get("/", requireAnyClientPermission, async (request, response, next) => {
    try {
      const adminRequest = request as AuthenticatedAdminRequest;
      const clients = await listClientsForAdmin(pool, {
        isSuperAdmin: adminRequest.adminSession.user.isSuperAdmin,
        offlineAfterSeconds: config.clientAuth.offlineAfterSeconds,
        permissionAction: "manage_clients",
        userId: adminRequest.adminSession.user.id,
      });
      const canEnrollClients =
        adminRequest.adminSession.user.isSuperAdmin ||
        (await adminUserHasPermission(pool, {
          action: "manage_clients",
          target: {
            targetId: null,
            targetType: "global",
          },
          userId: adminRequest.adminSession.user.id,
        }));

      response.json({
        capabilities: {
          canEnrollClients,
        },
        clients,
      } satisfies ClientListResponse);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:clientId", requireClientPermission, async (request, response, next) => {
    try {
      const clientId = readClientId(request.params);

      if (!clientId) {
        response.status(400).json({ error: "Client id is required" });
        return;
      }

      const client = await loadClientDetail(pool, clientId, config.clientAuth.offlineAfterSeconds);

      if (!client) {
        response.status(404).json({ error: "Client was not found" });
        return;
      }

      response.json({ client } satisfies ClientResponse);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:clientId/profile", requireClientPermission, async (request, response, next) => {
    try {
      const clientId = readClientId(request.params);
      const name = readClientName(request.body ?? {});

      if (!clientId) {
        response.status(400).json({ error: "Client id is required" });
        return;
      }

      if (typeof name !== "string") {
        response.status(400).json({ error: name.error });
        return;
      }

      if (!(await updateClientProfile(pool, { clientId, name }))) {
        response.status(404).json({ error: "Client was not found" });
        return;
      }

      response.json({
        client: await requireClientDetail(pool, clientId, config.clientAuth.offlineAfterSeconds),
      } satisfies ClientResponse);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:clientId/status", requireClientPermission, async (request, response, next) => {
    try {
      const clientId = readClientId(request.params);
      const accessStatus = readClientStatus(request.body ?? {});

      if (!clientId) {
        response.status(400).json({ error: "Client id is required" });
        return;
      }

      if (typeof accessStatus !== "string") {
        response.status(400).json({ error: accessStatus.error });
        return;
      }

      if (!(await updateClientStatus(pool, { accessStatus, clientId }))) {
        response.status(404).json({ error: "Client was not found" });
        return;
      }

      response.json({
        client: await requireClientDetail(pool, clientId, config.clientAuth.offlineAfterSeconds),
      } satisfies ClientResponse);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
