import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import type { ServerConfig } from "../config.js";
import {
  adminUserHasPermission,
  createGroup,
  isDuplicateEntryError,
  listGroupsForAdmin,
} from "../database.js";
import { requireGroupDetail } from "../services/groupDetails.js";
import type { GroupListResponse, GroupResponse } from "../../../shared/groupContracts.js";
import type { AdminGroupPermissionMiddleware } from "./adminGroupPermissions.js";
import { readGroupName } from "./adminGroupRequestParsers.js";

export function createAdminGroupCollectionRouter(
  pool: Pool,
  config: ServerConfig,
  permissions: AdminGroupPermissionMiddleware,
): Router {
  const router = Router();

  router.get("/", permissions.requireAnyGroupPermission, async (request, response, next) => {
    try {
      const adminRequest = request as AuthenticatedAdminRequest;
      const canCreateGroups =
        adminRequest.adminSession.user.isSuperAdmin ||
        (await adminUserHasPermission(pool, {
          action: "manage_groups",
          target: { targetId: null, targetType: "global" },
          userId: adminRequest.adminSession.user.id,
        }));

      response.json({
        capabilities: { canCreateGroups },
        groups: await listGroupsForAdmin(pool, {
          isSuperAdmin: adminRequest.adminSession.user.isSuperAdmin,
          permissionAction: "manage_groups",
          userId: adminRequest.adminSession.user.id,
        }),
      } satisfies GroupListResponse);
    } catch (error) {
      next(error);
    }
  });

  router.post("/", permissions.requireGlobalGroupPermission, async (request, response, next) => {
    try {
      const name = readGroupName(request.body ?? {});

      if (typeof name !== "string") {
        response.status(400).json({ error: name.error });
        return;
      }

      const groupId = randomUUID();

      await createGroup(pool, { id: groupId, name });
      response.status(201).json({
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

  return router;
}
