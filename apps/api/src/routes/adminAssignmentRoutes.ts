import { Router } from "express";
import type { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { createRequireAnyAdminPermissionMiddleware } from "../auth/adminPermissions.js";
import type { ServerConfig } from "../config.js";
import { listAssets, listClientsForAdmin, listGroupsForAdmin } from "../database.js";
import type {
  AssetListResponse,
  AssignmentGroupListResponse,
  AssignmentClientListResponse,
} from "../../../shared/adminContracts.js";
import { createAdminClientAssignmentRouter } from "./adminClientAssignmentRoutes.js";
import { createAdminGlobalAssignmentRouter } from "./adminGlobalAssignmentRoutes.js";
import { createAdminGroupAssignmentRouter } from "./adminGroupAssignmentRoutes.js";

export function createAdminAssignmentRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireAdminAuth = createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName);
  const requireAnyAssignmentPermission = createRequireAnyAdminPermissionMiddleware(
    pool,
    "manage_assignments",
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

  router.use("/clients", createAdminClientAssignmentRouter(pool, config));
  router.use("/groups", createAdminGroupAssignmentRouter(pool));
  router.use("/global", createAdminGlobalAssignmentRouter(pool));

  return router;
}
