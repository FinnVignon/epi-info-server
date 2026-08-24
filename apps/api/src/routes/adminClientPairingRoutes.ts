import { Router } from "express";
import type { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { hashClientCredential } from "../auth/clientCredentials.js";
import {
  createRequireAdminPermissionMiddleware,
  fixedAdminPermissionTarget,
} from "../auth/adminPermissions.js";
import type { ServerConfig } from "../config.js";
import {
  approveClientPairing,
  findPendingClientPairingByUserCode,
  listClientPairingGroupOptions,
  rejectClientPairing,
} from "../database.js";
import type {
  ClientPairingActionResponse,
  LookupClientPairingResponse,
} from "../../../shared/clientPairingContracts.js";
import {
  readPairingApprovalBody,
  readPairingId,
  readPairingUserCode,
} from "./clientPairingRequestParsers.js";
import { checkPairingLookupRateLimit } from "./clientPairingRateLimits.js";

export function createAdminClientPairingRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();

  router.use(createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName));
  router.use(
    createRequireAdminPermissionMiddleware(
      pool,
      "manage_clients",
      fixedAdminPermissionTarget({ targetId: null, targetType: "global" }),
    ),
  );

  router.post("/lookup", async (request, response, next) => {
    try {
      const userCode = readPairingUserCode(request.body ?? {});

      if (!userCode) {
        response.status(400).json({ error: "Pairing code is invalid" });
        return;
      }

      const userCodeHash = hashClientCredential(userCode);

      if (!checkPairingLookupRateLimit(request, response, userCodeHash)) {
        return;
      }

      const [pairing, groups] = await Promise.all([
        findPendingClientPairingByUserCode(pool, userCodeHash),
        listClientPairingGroupOptions(pool),
      ]);

      if (!pairing) {
        response.status(404).json({ error: "Pairing code was not found or has expired" });
        return;
      }

      response.setHeader("Cache-Control", "no-store");
      response.json({ groups, pairing } satisfies LookupClientPairingResponse);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:pairingId/approve", async (request, response, next) => {
    try {
      const pairingId = readPairingId(request.params);
      const approval = readPairingApprovalBody(request.body ?? {});

      if (!pairingId) {
        response.status(400).json({ error: "Pairing id is invalid" });
        return;
      }

      if (typeof approval === "string") {
        response.status(400).json({ error: approval });
        return;
      }

      const adminRequest = request as unknown as AuthenticatedAdminRequest;
      const result = await approveClientPairing(pool, {
        adminUserId: adminRequest.adminSession.user.id,
        groupId: approval.groupId,
        name: approval.name,
        pairingId,
      });

      if (result === "group_not_found") {
        response.status(400).json({ error: "Group was not found" });
        return;
      }

      if (result !== "approved") {
        response.status(result === "expired" ? 410 : 409).json({
          error: result === "expired" ? "Pairing session has expired" : "Pairing is unavailable",
        });
        return;
      }

      response.json({ status: "approved" } satisfies ClientPairingActionResponse);
    } catch (error) {
      next(error);
    }
  });

  router.post("/:pairingId/reject", async (request, response, next) => {
    try {
      const pairingId = readPairingId(request.params);

      if (!pairingId) {
        response.status(400).json({ error: "Pairing id is invalid" });
        return;
      }

      const adminRequest = request as unknown as AuthenticatedAdminRequest;
      const result = await rejectClientPairing(pool, pairingId, adminRequest.adminSession.user.id);

      if (result !== "rejected") {
        response.status(result === "expired" ? 410 : 409).json({
          error: result === "expired" ? "Pairing session has expired" : "Pairing is unavailable",
        });
        return;
      }

      response.json({ status: "rejected" } satisfies ClientPairingActionResponse);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
