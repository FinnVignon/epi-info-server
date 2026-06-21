import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "mysql2/promise";

import {
  type AuthenticatedClientRequest,
  createClientAuthMiddleware,
  createClientSecret,
  hashClientCredential,
} from "../auth/clientCredentials.js";
import type { ServerConfig } from "../config.js";
import { recordClientHeartbeat, registerClientWithEnrollmentToken } from "../database.js";
import type {
  ClientHeartbeatResponse,
  RegisterClientResponse,
} from "../../../shared/clientContracts.js";
import { readHeartbeatBody, readRegistrationBody } from "./clientConnectionRequestParsers.js";
import { checkRegistrationRateLimit } from "./clientRegistrationRateLimits.js";

export function createClientConnectionRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireClientAuth = createClientAuthMiddleware(pool);

  router.post("/register", async (request, response, next) => {
    try {
      if (!checkRegistrationRateLimit(request, response)) {
        return;
      }

      const body = readRegistrationBody(request.body ?? {});

      if (typeof body === "string") {
        response.status(400).json({ error: body });
        return;
      }

      const clientId = randomUUID();
      const clientSecret = createClientSecret();
      const registration = await registerClientWithEnrollmentToken(pool, {
        clientId,
        credentialHash: hashClientCredential(clientSecret),
        enrollmentTokenHash: hashClientCredential(body.enrollmentToken),
        name: body.name,
        softwareVersion: body.softwareVersion ?? null,
      });

      if (registration.status !== "created") {
        response.status(401).json({ error: "Enrollment token is invalid or expired" });
        return;
      }

      response.setHeader("Cache-Control", "no-store");
      response.status(201).json({
        clientId: registration.clientId,
        clientSecret,
        heartbeatIntervalSeconds: config.clientAuth.heartbeatIntervalSeconds,
      } satisfies RegisterClientResponse);
    } catch (error) {
      next(error);
    }
  });

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
