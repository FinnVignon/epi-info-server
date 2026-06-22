import { Router } from "express";
import type { Pool } from "mysql2/promise";

import { createRequireAdminPermissionMiddleware } from "../auth/adminPermissions.js";
import { findGroupById, type AssignmentTarget } from "../database.js";
import type { ClientLiveUpdateHub } from "../live/clientLiveUpdateHub.js";
import { assignDisplayContentToTarget } from "../services/displayAssignments.js";
import type { AssignmentResponse } from "../../../shared/adminContracts.js";
import { notifyAssignmentChanged, readAssignmentBody } from "./adminAssignmentRouteUtils.js";

interface GroupAssignmentRouteParams {
  groupId?: string;
}

export function createAdminGroupAssignmentRouter(
  pool: Pool,
  liveUpdates: ClientLiveUpdateHub,
): Router {
  const router = Router();
  const requireGroupAssignmentPermission = createRequireAdminPermissionMiddleware(
    pool,
    "manage_assignments",
    (request) => ({
      targetId: readGroupId(request.params) ?? "",
      targetType: "group",
    }),
  );

  router.put("/:groupId", requireGroupAssignmentPermission, async (request, response, next) => {
    try {
      const groupId = readGroupId(request.params);
      const assignment = readAssignmentBody(request.body ?? {});

      if (!groupId) {
        response.status(400).json({ error: "Group id is required" });
        return;
      }

      if (typeof assignment === "string") {
        response.status(400).json({ error: assignment });
        return;
      }

      if (!(await findGroupById(pool, groupId))) {
        response.status(404).json({ error: "Group was not found" });
        return;
      }

      const target: AssignmentTarget = {
        targetId: groupId,
        targetType: "group",
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

function readGroupId(params: GroupAssignmentRouteParams): string | null {
  return typeof params.groupId === "string" && params.groupId.length > 0 ? params.groupId : null;
}
