import { Router } from "express";
import type { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import type { ServerConfig } from "../config.js";
import {
  deleteGroup,
  isDuplicateEntryError,
  listClientsForAdmin,
  updateGroup,
} from "../database.js";
import { loadGroupDetail, requireGroupDetail } from "../services/groupDetails.js";
import type { GroupClientOptionsResponse, GroupResponse } from "../../../shared/groupContracts.js";
import type { AdminGroupPermissionMiddleware } from "./adminGroupPermissions.js";
import { readGroupName, readRouteId } from "./adminGroupRequestParsers.js";

export function createAdminGroupDetailRouter(
  pool: Pool,
  config: ServerConfig,
  permissions: AdminGroupPermissionMiddleware,
): Router {
  const router = Router();

  router.get("/:groupId", permissions.requireGroupPermission, async (request, response, next) => {
    try {
      const groupId = readRouteId(request.params, "groupId");

      if (!groupId) {
        response.status(400).json({ error: "Group id is required" });
        return;
      }

      const group = await loadGroupDetail(pool, groupId, config.clientAuth.offlineAfterSeconds);

      if (!group) {
        response.status(404).json({ error: "Group was not found" });
        return;
      }

      response.json({ group } satisfies GroupResponse);
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/:groupId/client-options",
    permissions.requireGroupPermission,
    async (request, response, next) => {
      try {
        const adminRequest = request as AuthenticatedAdminRequest;

        response.json({
          clients: await listClientsForAdmin(pool, {
            isSuperAdmin: adminRequest.adminSession.user.isSuperAdmin,
            offlineAfterSeconds: config.clientAuth.offlineAfterSeconds,
            permissionAction: "manage_clients",
            userId: adminRequest.adminSession.user.id,
          }),
        } satisfies GroupClientOptionsResponse);
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch("/:groupId", permissions.requireGroupPermission, async (request, response, next) => {
    try {
      const groupId = readRouteId(request.params, "groupId");
      const name = readGroupName(request.body ?? {});

      if (!groupId) {
        response.status(400).json({ error: "Group id is required" });
        return;
      }

      if (typeof name !== "string") {
        response.status(400).json({ error: name.error });
        return;
      }

      if (!(await updateGroup(pool, { groupId, name }))) {
        response.status(404).json({ error: "Group was not found" });
        return;
      }

      response.json({
        group: await requireGroupDetail(pool, groupId, config.clientAuth.offlineAfterSeconds),
      } satisfies GroupResponse);
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        response.status(409).json({ error: "A group with this name already exists" });
        return;
      }

      next(error);
    }
  });

  router.delete(
    "/:groupId",
    permissions.requireGroupPermission,
    async (request, response, next) => {
      try {
        const groupId = readRouteId(request.params, "groupId");

        if (!groupId) {
          response.status(400).json({ error: "Group id is required" });
          return;
        }

        if (!(await deleteGroup(pool, groupId))) {
          response.status(404).json({ error: "Group was not found" });
          return;
        }

        response.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
