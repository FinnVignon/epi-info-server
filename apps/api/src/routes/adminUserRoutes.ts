import { Router } from "express";
import type { Pool } from "mysql2/promise";

import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { createRequireSuperAdminMiddleware } from "../auth/adminPermissions.js";
import type { ServerConfig } from "../config.js";
import { createAdminUserCollectionRouter } from "./adminUserCollectionRoutes.js";
import { createAdminUserDetailRouter } from "./adminUserDetailRoutes.js";
import { createAdminUserSecurityRouter } from "./adminUserSecurityRoutes.js";

export function createAdminUserRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();

  router.use(
    createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName),
    createRequireSuperAdminMiddleware(),
  );
  router.use(createAdminUserCollectionRouter(pool, config));
  router.use(createAdminUserDetailRouter(pool));
  router.use(createAdminUserSecurityRouter(pool, config));

  return router;
}
