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
  findClientById,
  listClientsForAdmin,
  updateClientProfile,
  updateClientStatus,
} from "../database.js";
import type {
  ClientAccessStatus,
  ClientListResponse,
  ClientResponse,
  UpdateClientProfileRequest,
  UpdateClientStatusRequest,
} from "../../../shared/clientContracts.js";

interface ClientRouteParams {
  clientId?: string;
}

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
        userId: adminRequest.adminSession.user.id,
      });

      response.json({ clients } satisfies ClientListResponse);
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

      const client = await findClientById(pool, clientId, config.clientAuth.offlineAfterSeconds);

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
      const name = readClientName((request.body ?? {}) as Partial<UpdateClientProfileRequest>);

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
        client: await requireClient(pool, clientId, config.clientAuth.offlineAfterSeconds),
      } satisfies ClientResponse);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:clientId/status", requireClientPermission, async (request, response, next) => {
    try {
      const clientId = readClientId(request.params);
      const accessStatus = readClientStatus(
        (request.body ?? {}) as Partial<UpdateClientStatusRequest>,
      );

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
        client: await requireClient(pool, clientId, config.clientAuth.offlineAfterSeconds),
      } satisfies ClientResponse);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function readClientId(params: ClientRouteParams): string | null {
  return typeof params.clientId === "string" && params.clientId.length > 0 ? params.clientId : null;
}

function readClientName(body: Partial<UpdateClientProfileRequest>): string | { error: string } {
  if (typeof body.name !== "string") {
    return { error: "Client name is required" };
  }

  const name = body.name.trim();

  if (name.length < 2) {
    return { error: "Client name must be at least 2 characters" };
  }

  if (name.length > 255) {
    return { error: "Client name must not exceed 255 characters" };
  }

  return name;
}

function readClientStatus(
  body: Partial<UpdateClientStatusRequest>,
): ClientAccessStatus | { error: string } {
  if (body.accessStatus !== "active" && body.accessStatus !== "disabled") {
    return { error: "Access status must be active or disabled" };
  }

  return body.accessStatus;
}

async function requireClient(pool: Pool, clientId: string, offlineAfterSeconds: number) {
  const client = await findClientById(pool, clientId, offlineAfterSeconds);

  if (!client) {
    throw new Error("Updated client could not be loaded");
  }

  return client;
}
