import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import {
  createRequireAdminPermissionMiddleware,
  createRequireAnyAdminPermissionMiddleware,
  fixedAdminPermissionTarget,
} from "../auth/adminPermissions.js";
import type { ServerConfig } from "../config.js";
import {
  addClientToGroup,
  adminUserHasPermission,
  createGroup,
  deleteGroup,
  findClientById,
  findGroupById,
  listClientsForAdmin,
  listClientsInGroup,
  listGroupsForAdmin,
  removeClientFromGroup,
  updateGroup,
} from "../database.js";
import type {
  CreateGroupRequest,
  DisplayGroupDetail,
  GroupClientOptionsResponse,
  GroupListResponse,
  GroupResponse,
  UpdateGroupRequest,
} from "../../../shared/groupContracts.js";

interface GroupRouteParams {
  clientId?: string;
  groupId?: string;
}

export function createAdminGroupRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireAdminAuth = createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName);
  const requireAnyGroupPermission = createRequireAnyAdminPermissionMiddleware(
    pool,
    "manage_groups",
  );
  const requireGlobalGroupPermission = createRequireAdminPermissionMiddleware(
    pool,
    "manage_groups",
    fixedAdminPermissionTarget({
      targetId: null,
      targetType: "global",
    }),
  );
  const requireGroupPermission = createRequireAdminPermissionMiddleware(
    pool,
    "manage_groups",
    (request) => ({
      targetId: readRouteId(request.params, "groupId") ?? "",
      targetType: "group",
    }),
  );
  const requireClientPermission = createRequireAdminPermissionMiddleware(
    pool,
    "manage_clients",
    (request) => ({
      targetId: readRouteId(request.params, "clientId") ?? "",
      targetType: "client",
    }),
  );

  router.use(requireAdminAuth);

  router.get("/", requireAnyGroupPermission, async (request, response, next) => {
    try {
      const adminRequest = request as AuthenticatedAdminRequest;
      const canCreateGroups =
        adminRequest.adminSession.user.isSuperAdmin ||
        (await adminUserHasPermission(pool, {
          action: "manage_groups",
          target: {
            targetId: null,
            targetType: "global",
          },
          userId: adminRequest.adminSession.user.id,
        }));

      response.json({
        capabilities: {
          canCreateGroups,
        },
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

  router.post("/", requireGlobalGroupPermission, async (request, response, next) => {
    try {
      const name = readGroupName((request.body ?? {}) as Partial<CreateGroupRequest>);

      if (typeof name !== "string") {
        response.status(400).json({ error: name.error });
        return;
      }

      const groupId = randomUUID();

      await createGroup(pool, {
        id: groupId,
        name,
      });
      response.status(201).json({
        group: await requireGroupDetail(pool, groupId, config.clientAuth.offlineAfterSeconds),
      } satisfies GroupResponse);
    } catch (error) {
      if (isDuplicateGroupNameError(error)) {
        response.status(409).json({ error: "A group with this name already exists" });
        return;
      }

      next(error);
    }
  });

  router.get("/:groupId", requireGroupPermission, async (request, response, next) => {
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
    requireGroupPermission,
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

  router.patch("/:groupId", requireGroupPermission, async (request, response, next) => {
    try {
      const groupId = readRouteId(request.params, "groupId");
      const name = readGroupName((request.body ?? {}) as Partial<UpdateGroupRequest>);

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
      if (isDuplicateGroupNameError(error)) {
        response.status(409).json({ error: "A group with this name already exists" });
        return;
      }

      next(error);
    }
  });

  router.delete("/:groupId", requireGroupPermission, async (request, response, next) => {
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
  });

  router.put(
    "/:groupId/members/:clientId",
    requireGroupPermission,
    requireClientPermission,
    async (request, response, next) => {
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

        if (
          !(await findClientById(pool, routeIds.clientId, config.clientAuth.offlineAfterSeconds))
        ) {
          response.status(404).json({ error: "Client was not found" });
          return;
        }

        await addClientToGroup(pool, routeIds.groupId, routeIds.clientId);
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
    },
  );

  router.delete(
    "/:groupId/members/:clientId",
    requireGroupPermission,
    requireClientPermission,
    async (request, response, next) => {
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

        if (
          !(await findClientById(pool, routeIds.clientId, config.clientAuth.offlineAfterSeconds))
        ) {
          response.status(404).json({ error: "Client was not found" });
          return;
        }

        await removeClientFromGroup(pool, routeIds.groupId, routeIds.clientId);
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
    },
  );

  return router;
}

function readRouteId(params: GroupRouteParams, key: keyof GroupRouteParams): string | null {
  const value = params[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}

function readMembershipRouteIds(
  params: GroupRouteParams,
): { clientId: string; groupId: string } | null {
  const clientId = readRouteId(params, "clientId");
  const groupId = readRouteId(params, "groupId");

  return clientId && groupId ? { clientId, groupId } : null;
}

function readGroupName(
  body: Partial<CreateGroupRequest | UpdateGroupRequest>,
): string | { error: string } {
  if (typeof body.name !== "string") {
    return { error: "Group name is required" };
  }

  const name = body.name.trim();

  if (name.length < 2) {
    return { error: "Group name must be at least 2 characters" };
  }

  if (name.length > 255) {
    return { error: "Group name must not exceed 255 characters" };
  }

  return name;
}

async function loadGroupDetail(
  pool: Pool,
  groupId: string,
  offlineAfterSeconds: number,
): Promise<DisplayGroupDetail | null> {
  const group = await findGroupById(pool, groupId);

  if (!group) {
    return null;
  }

  return {
    ...group,
    members: await listClientsInGroup(pool, groupId, offlineAfterSeconds),
  };
}

async function requireGroupDetail(
  pool: Pool,
  groupId: string,
  offlineAfterSeconds: number,
): Promise<DisplayGroupDetail> {
  const group = await loadGroupDetail(pool, groupId, offlineAfterSeconds);

  if (!group) {
    throw new Error("Updated group could not be loaded");
  }

  return group;
}

function isDuplicateGroupNameError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY"
  );
}
