import { Router } from "express";
import type { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import {
  deleteAdminSessionsForUser,
  findAdminUserById,
  updateAdminUserProfile,
  updateAdminUserStatus,
} from "../database.js";
import { findAdminUserWithPermissions } from "../services/adminUserDetails.js";
import type {
  UpdateAdminUserProfileRequest,
  UpdateAdminUserStatusRequest,
} from "../../../shared/adminContracts.js";
import { readProfileBody, readStatusBody, readUserId } from "./adminUserRequestParsers.js";

export function createAdminUserDetailRouter(pool: Pool): Router {
  const router = Router();

  router.get("/:userId", async (request, response, next) => {
    try {
      const userId = readUserId(request.params);

      if (!userId) {
        response.status(400).json({ error: "User id is required" });
        return;
      }

      const user = await findAdminUserWithPermissions(pool, userId);

      if (!user) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:userId/profile", async (request, response, next) => {
    try {
      const userId = readUserId(request.params);
      const profile = readProfileBody(
        (request.body ?? {}) as Partial<UpdateAdminUserProfileRequest>,
      );

      if (!userId) {
        response.status(400).json({ error: "User id is required" });
        return;
      }

      if (typeof profile === "string") {
        response.status(400).json({ error: profile });
        return;
      }

      if (!(await findAdminUserById(pool, userId))) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      await updateAdminUserProfile(pool, { displayName: profile.displayName, userId });
      const user = await findAdminUserWithPermissions(pool, userId);

      if (!user) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:userId/status", async (request, response, next) => {
    try {
      const userId = readUserId(request.params);
      const status = readStatusBody((request.body ?? {}) as Partial<UpdateAdminUserStatusRequest>);

      if (!userId) {
        response.status(400).json({ error: "User id is required" });
        return;
      }

      if (typeof status === "string") {
        response.status(400).json({ error: status });
        return;
      }

      const adminRequest = request as unknown as AuthenticatedAdminRequest;

      if (userId === adminRequest.adminSession.user.id && status.status === "disabled") {
        response.status(400).json({ error: "You cannot disable your own admin user" });
        return;
      }

      if (!(await findAdminUserById(pool, userId))) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      await updateAdminUserStatus(pool, { status: status.status, userId });
      await deleteAdminSessionsForUser(pool, userId);
      const user = await findAdminUserWithPermissions(pool, userId);

      if (!user) {
        response.status(404).json({ error: "Admin user was not found" });
        return;
      }

      response.json({ user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
