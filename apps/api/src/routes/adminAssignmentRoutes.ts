import { randomUUID } from "node:crypto";
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
  assignAssetToClient,
  findAssetById,
  findClientById,
  listAssets,
  listClientsForAdmin,
} from "../database.js";
import type {
  AssetListResponse,
  AssignAssetToClientRequest,
  AssignmentClientListResponse,
  ClientAssignmentResponse,
} from "../../../shared/adminContracts.js";

const SINGLE_ITEM_DURATION_SECONDS = 30;

interface ClientAssignmentRouteParams {
  clientId?: string;
}

export function createAdminAssignmentRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireAdminAuth = createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName);
  const requireAnyAssignmentPermission = createRequireAnyAdminPermissionMiddleware(
    pool,
    "manage_assignments",
  );
  const requireClientAssignmentPermission = createRequireAdminPermissionMiddleware(
    pool,
    "manage_assignments",
    (request) => ({
      targetId: readClientId(request.params) ?? "",
      targetType: "client",
    }),
  );

  router.use(requireAdminAuth);

  router.get("/assets", requireAnyAssignmentPermission, async (_request, response, next) => {
    try {
      const assets = (await listAssets(pool)).filter((asset) => asset.status === "active");

      response.json({ assets } satisfies AssetListResponse);
    } catch (error) {
      next(error);
    }
  });

  router.get("/clients", requireAnyAssignmentPermission, async (request, response, next) => {
    try {
      const adminRequest = request as AuthenticatedAdminRequest;
      const clients = await listClientsForAdmin(pool, {
        isSuperAdmin: adminRequest.adminSession.user.isSuperAdmin,
        offlineAfterSeconds: config.clientAuth.offlineAfterSeconds,
        permissionAction: "manage_assignments",
        userId: adminRequest.adminSession.user.id,
      });

      response.json({ clients } satisfies AssignmentClientListResponse);
    } catch (error) {
      next(error);
    }
  });

  router.put(
    "/clients/:clientId",
    requireClientAssignmentPermission,
    async (request, response, next) => {
      try {
        const clientId = readClientId(request.params);
        const assignment = readAssignmentBody(
          (request.body ?? {}) as Partial<AssignAssetToClientRequest>,
        );

        if (!clientId) {
          response.status(400).json({ error: "Client id is required" });
          return;
        }

        if (typeof assignment === "string") {
          response.status(400).json({ error: assignment });
          return;
        }

        const [client, asset] = await Promise.all([
          findClientById(pool, clientId, config.clientAuth.offlineAfterSeconds),
          findAssetById(pool, assignment.assetId),
        ]);

        if (!client) {
          response.status(404).json({ error: "Client was not found" });
          return;
        }

        if (!asset || asset.status !== "active") {
          response.status(404).json({ error: "Active asset was not found" });
          return;
        }

        const safeFilename = encodeURIComponent(asset.originalFilename);
        const manifest = await assignAssetToClient(pool, {
          assetId: asset.id,
          assignmentId: randomUUID(),
          clientId,
          durationSeconds: SINGLE_ITEM_DURATION_SECONDS,
          fit: assignment.fit,
          itemId: randomUUID(),
          localPath: `/assets/${encodeURIComponent(asset.id)}/${safeFilename}`,
          manifestId: randomUUID(),
          manifestName: asset.displayName,
          remoteUrl: `/api/clients/assets/${encodeURIComponent(asset.id)}`,
          sha256: asset.sha256,
          type: asset.type,
        });

        response.json({ manifest } satisfies ClientAssignmentResponse);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

function readClientId(params: ClientAssignmentRouteParams): string | null {
  return typeof params.clientId === "string" && params.clientId.length > 0 ? params.clientId : null;
}

function readAssignmentBody(
  body: Partial<AssignAssetToClientRequest>,
): AssignAssetToClientRequest | string {
  if (typeof body.assetId !== "string" || body.assetId.trim().length === 0) {
    return "Asset id is required";
  }

  if (body.fit !== "contain" && body.fit !== "cover") {
    return "Fit must be contain or cover";
  }

  return {
    assetId: body.assetId.trim(),
    fit: body.fit,
  };
}
