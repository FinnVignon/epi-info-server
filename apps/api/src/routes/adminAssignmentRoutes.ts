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
  assignAssetToTarget,
  findAssetById,
  findClientById,
  findGroupById,
  listAssets,
  listClientsForAdmin,
  listGroupsForAdmin,
  removeAssignmentFromTarget,
} from "../database.js";
import type {
  AssetListResponse,
  AssignAssetRequest,
  AssignmentGroupListResponse,
  AssignmentResponse,
  AssignmentClientListResponse,
} from "../../../shared/adminContracts.js";
import type { AssetWithStoragePath } from "../database.js";
import type { AssignmentTargetType } from "../database.js";

const SINGLE_ITEM_DURATION_SECONDS = 30;

interface AssignmentRouteParams {
  clientId?: string;
  groupId?: string;
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
  const requireGroupAssignmentPermission = createRequireAdminPermissionMiddleware(
    pool,
    "manage_assignments",
    (request) => ({
      targetId: readGroupId(request.params) ?? "",
      targetType: "group",
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

  router.get("/groups", requireAnyAssignmentPermission, async (request, response, next) => {
    try {
      const adminRequest = request as AuthenticatedAdminRequest;
      const groups = await listGroupsForAdmin(pool, {
        isSuperAdmin: adminRequest.adminSession.user.isSuperAdmin,
        permissionAction: "manage_assignments",
        userId: adminRequest.adminSession.user.id,
      });

      response.json({ groups } satisfies AssignmentGroupListResponse);
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
        const assignment = readAssignmentBody((request.body ?? {}) as Partial<AssignAssetRequest>);

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

        const manifest = await assignAsset(pool, asset, assignment, "client", clientId);

        response.json({ manifest } satisfies AssignmentResponse);
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/clients/:clientId",
    requireClientAssignmentPermission,
    async (request, response, next) => {
      try {
        const clientId = readClientId(request.params);

        if (!clientId) {
          response.status(400).json({ error: "Client id is required" });
          return;
        }

        if (!(await findClientById(pool, clientId, config.clientAuth.offlineAfterSeconds))) {
          response.status(404).json({ error: "Client was not found" });
          return;
        }

        await removeAssignmentFromTarget(pool, "client", clientId);
        response.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  router.put(
    "/groups/:groupId",
    requireGroupAssignmentPermission,
    async (request, response, next) => {
      try {
        const groupId = readGroupId(request.params);
        const assignment = readAssignmentBody((request.body ?? {}) as Partial<AssignAssetRequest>);

        if (!groupId) {
          response.status(400).json({ error: "Group id is required" });
          return;
        }

        if (typeof assignment === "string") {
          response.status(400).json({ error: assignment });
          return;
        }

        const [group, asset] = await Promise.all([
          findGroupById(pool, groupId),
          findAssetById(pool, assignment.assetId),
        ]);

        if (!group) {
          response.status(404).json({ error: "Group was not found" });
          return;
        }

        if (!asset || asset.status !== "active") {
          response.status(404).json({ error: "Active asset was not found" });
          return;
        }

        const manifest = await assignAsset(pool, asset, assignment, "group", groupId);

        response.json({ manifest } satisfies AssignmentResponse);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

function readClientId(params: AssignmentRouteParams): string | null {
  return typeof params.clientId === "string" && params.clientId.length > 0 ? params.clientId : null;
}

function readGroupId(params: AssignmentRouteParams): string | null {
  return typeof params.groupId === "string" && params.groupId.length > 0 ? params.groupId : null;
}

function readAssignmentBody(body: Partial<AssignAssetRequest>): AssignAssetRequest | string {
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

async function assignAsset(
  pool: Pool,
  asset: AssetWithStoragePath,
  assignment: AssignAssetRequest,
  targetType: AssignmentTargetType,
  targetId: string,
) {
  const safeFilename = encodeURIComponent(asset.originalFilename);

  return assignAssetToTarget(pool, {
    assetId: asset.id,
    assignmentId: randomUUID(),
    durationSeconds: SINGLE_ITEM_DURATION_SECONDS,
    fit: assignment.fit,
    itemId: randomUUID(),
    localPath: `/assets/${encodeURIComponent(asset.id)}/${safeFilename}`,
    manifestId: randomUUID(),
    manifestName: asset.displayName,
    remoteUrl: `/api/clients/assets/${encodeURIComponent(asset.id)}`,
    sha256: asset.sha256,
    targetId,
    targetType,
    type: asset.type,
  });
}
