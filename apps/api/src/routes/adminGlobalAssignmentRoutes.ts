import { Router } from "express";
import type { Pool } from "mysql2/promise";

import { createRequireAdminPermissionMiddleware } from "../auth/adminPermissions.js";
import type { AssignmentTarget } from "../database.js";
import type { ClientLiveUpdateHub } from "../live/clientLiveUpdateHub.js";
import { assignDisplayContentToTarget } from "../services/displayAssignments.js";
import type {
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
      const assignment = readAssignmentBody(request.body ?? {});

      if (typeof assignment === "string") {
        response.status(400).json({ error: assignment });
        return;
      }

      const target: AssignmentTarget = {
        targetId: null,
        targetType: "global",
      };
      const manifest = await assignDisplayContentToTarget(pool, assignment, target);

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
