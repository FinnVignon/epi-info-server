import { Router } from "express";
import type { Pool } from "mysql2/promise";

import { createRequireAdminPermissionMiddleware } from "../auth/adminPermissions.js";
import type { AssignmentTarget } from "../database.js";
import type { ClientLiveUpdateHub } from "../live/clientLiveUpdateHub.js";
import { assignActiveAssetToTarget } from "../services/assetAssignments.js";
import type {
  AssignAssetRequest,
  AssignmentGlobalTargetResponse,
  AssignmentResponse,
} from "../../../shared/adminContracts.js";
import { notifyAssignmentChanged, readAssignmentBody } from "./adminAssignmentRouteUtils.js";

const GLOBAL_ASSIGNMENT_TARGET = {
  id: "global",
  name: "All displays",
} as const;

export function createAdminGlobalAssignmentRouter(
  pool: Pool,
  liveUpdates: ClientLiveUpdateHub,
): Router {
  const router = Router();
  const requireGlobalAssignmentPermission = createRequireAdminPermissionMiddleware(
    pool,
    "manage_assignments",
  );

  router.use(requireGlobalAssignmentPermission);

  router.get("/", (_request, response) => {
    response.json({
      target: GLOBAL_ASSIGNMENT_TARGET,
    } satisfies AssignmentGlobalTargetResponse);
  });

  router.put("/", async (request, response, next) => {
    try {
      const assignment = readAssignmentBody((request.body ?? {}) as Partial<AssignAssetRequest>);

      if (typeof assignment === "string") {
        response.status(400).json({ error: assignment });
        return;
      }

      const target: AssignmentTarget = {
        targetId: null,
        targetType: "global",
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
