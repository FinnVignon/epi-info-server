import { Router } from "express";
import type { Pool } from "mysql2/promise";

import { createRequireAdminPermissionMiddleware } from "../auth/adminPermissions.js";
import type { ServerConfig } from "../config.js";
import { findClientById, type AssignmentTarget } from "../database.js";
import type { ClientLiveUpdateHub } from "../live/clientLiveUpdateHub.js";
import { assignActiveAssetToTarget } from "../services/assetAssignments.js";
import type { AssignAssetRequest, AssignmentResponse } from "../../../shared/adminContracts.js";
import { notifyAssignmentChanged, readAssignmentBody } from "./adminAssignmentRouteUtils.js";

interface ClientAssignmentRouteParams {
  clientId?: string;
}

export function createAdminClientAssignmentRouter(
  pool: Pool,
  config: ServerConfig,
  liveUpdates: ClientLiveUpdateHub,
): Router {
  const router = Router();
  const requireClientAssignmentPermission = createRequireAdminPermissionMiddleware(
    pool,
    "manage_assignments",
    (request) => ({
      targetId: readClientId(request.params) ?? "",
      targetType: "client",
    }),
  );

  router.put("/:clientId", requireClientAssignmentPermission, async (request, response, next) => {
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

      if (!(await findClientById(pool, clientId, config.clientAuth.offlineAfterSeconds))) {
        response.status(404).json({ error: "Client was not found" });
        return;
      }

      const target: AssignmentTarget = {
        targetId: clientId,
        targetType: "client",
      };
      const manifest = await assignActiveAssetToTarget(pool, assignment, target);

      if (!manifest) {
        response.status(404).json({ error: "Active asset was not found" });
        return;
      }

      notifyAssignmentChanged(liveUpdates, target);
      response.json({ manifest } satisfies AssignmentResponse);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function readClientId(params: ClientAssignmentRouteParams): string | null {
  return typeof params.clientId === "string" && params.clientId.length > 0 ? params.clientId : null;
}
