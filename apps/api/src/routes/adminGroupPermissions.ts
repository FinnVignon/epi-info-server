import type { RequestHandler } from "express";
import type { Pool } from "mysql2/promise";

import {
  createRequireAdminPermissionMiddleware,
  createRequireAnyAdminPermissionMiddleware,
  fixedAdminPermissionTarget,
} from "../auth/adminPermissions.js";
import { readRouteId } from "./adminGroupRequestParsers.js";

export interface AdminGroupPermissionMiddleware {
  requireAnyGroupPermission: RequestHandler;
  requireClientPermission: RequestHandler;
  requireGlobalGroupPermission: RequestHandler;
  requireGroupPermission: RequestHandler;
}

export function createAdminGroupPermissionMiddleware(pool: Pool): AdminGroupPermissionMiddleware {
  return {
    requireAnyGroupPermission: createRequireAnyAdminPermissionMiddleware(pool, "manage_groups"),
    requireClientPermission: createRequireAdminPermissionMiddleware(
      pool,
      "manage_clients",
      (request) => ({
        targetId: readRouteId(request.params, "clientId") ?? "",
        targetType: "client",
      }),
    ),
    requireGlobalGroupPermission: createRequireAdminPermissionMiddleware(
      pool,
      "manage_groups",
      fixedAdminPermissionTarget({ targetId: null, targetType: "global" }),
    ),
    requireGroupPermission: createRequireAdminPermissionMiddleware(
      pool,
      "manage_groups",
      (request) => ({
        targetId: readRouteId(request.params, "groupId") ?? "",
        targetType: "group",
      }),
    ),
  };
}
