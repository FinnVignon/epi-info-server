import { NextFunction, Request, RequestHandler, Response } from "express";
import { Pool } from "mysql2/promise";

import { adminUserHasAnyPermission, adminUserHasPermission } from "../database.js";
import type {
  AdminPermissionAction,
  AdminPermissionTarget,
} from "../../../shared/adminContracts.js";
import type { AuthenticatedAdminRequest } from "./adminAuth.js";

export type AdminPermissionTargetResolver = (
  request: AuthenticatedAdminRequest,
) => AdminPermissionTarget | Promise<AdminPermissionTarget>;

export function createRequireSuperAdminMiddleware(): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    const adminRequest = getAuthenticatedAdminRequest(request);

    if (!adminRequest) {
      response.status(401).json({ error: "Admin authentication is required" });
      return;
    }

    if (!adminRequest.adminSession.user.isSuperAdmin) {
      response.status(403).json({ error: "Super admin access is required" });
      return;
    }

    next();
  };
}

export function createRequireAdminPermissionMiddleware(
  pool: Pool,
  action: AdminPermissionAction,
  resolveTarget: AdminPermissionTargetResolver = () => ({
    targetId: null,
    targetType: "global",
  }),
): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    const adminRequest = getAuthenticatedAdminRequest(request);

    if (!adminRequest) {
      response.status(401).json({ error: "Admin authentication is required" });
      return;
    }

    if (adminRequest.adminSession.user.isSuperAdmin) {
      next();
      return;
    }

    try {
      const target = await resolveTarget(adminRequest);

      if (!isAdminPermissionTarget(target)) {
        response.status(400).json({ error: "Permission target is invalid" });
        return;
      }

      const hasPermission = await adminUserHasPermission(pool, {
        action,
        target,
        userId: adminRequest.adminSession.user.id,
      });

      if (!hasPermission) {
        response.status(403).json({ error: "Admin permission is required" });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createRequireAnyAdminPermissionMiddleware(
  pool: Pool,
  action: AdminPermissionAction,
): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    const adminRequest = getAuthenticatedAdminRequest(request);

    if (!adminRequest) {
      response.status(401).json({ error: "Admin authentication is required" });
      return;
    }

    if (adminRequest.adminSession.user.isSuperAdmin) {
      next();
      return;
    }

    try {
      const hasPermission = await adminUserHasAnyPermission(pool, {
        action,
        userId: adminRequest.adminSession.user.id,
      });

      if (!hasPermission) {
        response.status(403).json({ error: "Admin permission is required" });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

export function fixedAdminPermissionTarget(
  target: AdminPermissionTarget,
): AdminPermissionTargetResolver {
  return () => target;
}

function getAuthenticatedAdminRequest(request: Request): AuthenticatedAdminRequest | null {
  const adminRequest = request as Partial<AuthenticatedAdminRequest>;

  return adminRequest.adminSession ? (request as AuthenticatedAdminRequest) : null;
}

function isAdminPermissionTarget(target: unknown): target is AdminPermissionTarget {
  if (typeof target !== "object" || target === null) {
    return false;
  }

  const permissionTarget = target as Partial<AdminPermissionTarget>;

  if (permissionTarget.targetType === "global") {
    return permissionTarget.targetId === null;
  }

  return (
    (permissionTarget.targetType === "client" || permissionTarget.targetType === "group") &&
    typeof permissionTarget.targetId === "string" &&
    permissionTarget.targetId.length > 0
  );
}
