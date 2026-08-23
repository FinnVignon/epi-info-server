import { Router } from "express";
import type { Pool } from "mysql2/promise";

import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import type { ServerConfig } from "../config.js";
import { createAdminGroupCollectionRouter } from "./adminGroupCollectionRoutes.js";
import { createAdminGroupDetailRouter } from "./adminGroupDetailRoutes.js";
import { createAdminGroupMembershipRouter } from "./adminGroupMembershipRoutes.js";
import { createAdminGroupPermissionMiddleware } from "./adminGroupPermissions.js";

export function createAdminGroupRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const permissions = createAdminGroupPermissionMiddleware(pool);

  router.use(createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName));
  router.use(createAdminGroupCollectionRouter(pool, config, permissions));
  router.use(createAdminGroupDetailRouter(pool, config, permissions));
  router.use(createAdminGroupMembershipRouter(pool, config, permissions));

  return router;
}
