import { Router } from "express";
import type { Pool } from "mysql2/promise";

import {
  type AuthenticatedClientRequest,
  createClientAuthMiddleware,
} from "../auth/clientCredentials.js";
import type { ServerConfig } from "../config.js";
import { recordClientHeartbeat } from "../database.js";
import type { ClientHeartbeatResponse } from "../../../shared/clientContracts.js";
import { readHeartbeatBody } from "./clientConnectionRequestParsers.js";

export function createClientConnectionRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireClientAuth = createClientAuthMiddleware(pool);

  router.post("/heartbeat", requireClientAuth, async (request, response, next) => {
    try {
      const heartbeat = readHeartbeatBody(request.body ?? {});

      if (typeof heartbeat === "string") {
        response.status(400).json({ error: heartbeat });
        return;
      }

      const clientRequest = request as AuthenticatedClientRequest;
      const updated = await recordClientHeartbeat(pool, clientRequest.clientIdentity.id, heartbeat);

      if (!updated) {
        response.status(401).json({ error: "Client authentication is required" });
        return;
      }

      response.json({
        heartbeatIntervalSeconds: config.clientAuth.heartbeatIntervalSeconds,
        serverTime: new Date().toISOString(),
      } satisfies ClientHeartbeatResponse);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
