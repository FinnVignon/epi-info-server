import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import type { Pool } from "mysql2/promise";

import type { ServerConfig } from "../config.js";
import {
  addClientToGroup,
  findClientById,
  findGroupById,
  removeClientFromGroup,
} from "../database.js";
import { requireGroupDetail } from "../services/groupDetails.js";
import type { GroupResponse } from "../../../shared/groupContracts.js";
import type { AdminGroupPermissionMiddleware } from "./adminGroupPermissions.js";
import { readMembershipRouteIds } from "./adminGroupRequestParsers.js";

type MembershipChange = (pool: Pool, groupId: string, clientId: string) => Promise<unknown>;

export function createAdminGroupMembershipRouter(
  pool: Pool,
  config: ServerConfig,
  permissions: AdminGroupPermissionMiddleware,
): Router {
  const router = Router();
  const middleware = [permissions.requireGroupPermission, permissions.requireClientPermission];

  router.put("/:groupId/members/:clientId", ...middleware, (request, response, next) => {
    void changeMembership(request, response, next, pool, config, addClientToGroup);
  });
  router.delete("/:groupId/members/:clientId", ...middleware, (request, response, next) => {
    void changeMembership(request, response, next, pool, config, removeClientFromGroup);
  });

  return router;
}

async function changeMembership(
  request: Request,
  response: Response,
  next: NextFunction,
  pool: Pool,
  config: ServerConfig,
  change: MembershipChange,
): Promise<void> {
  try {
    const routeIds = readMembershipRouteIds(request.params);

    if (!routeIds) {
      response.status(400).json({ error: "Group id and client id are required" });
      return;
    }

    if (!(await findGroupById(pool, routeIds.groupId))) {
      response.status(404).json({ error: "Group was not found" });
      return;
    }

    if (!(await findClientById(pool, routeIds.clientId, config.clientAuth.offlineAfterSeconds))) {
      response.status(404).json({ error: "Client was not found" });
      return;
    }

    await change(pool, routeIds.groupId, routeIds.clientId);
    response.json({
      group: await requireGroupDetail(
        pool,
        routeIds.groupId,
        config.clientAuth.offlineAfterSeconds,
      ),
    } satisfies GroupResponse);
  } catch (error) {
    next(error);
  }
}
