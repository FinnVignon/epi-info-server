import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Pool } from "mysql2/promise";

import { createClientSecret, hashClientCredential } from "../auth/clientCredentials.js";
import type { ServerConfig } from "../config.js";
import { activateClientPairing } from "../database.js";
import { createNewClientPairingSession } from "../services/clientPairingSessionCreation.js";
import type {
  ApprovedClientPairingResponse,
  PendingClientPairingResponse,
  TerminalClientPairingResponse,
} from "../../../shared/clientPairingContracts.js";
import { readCreatePairingBody, readPairingDeviceCode } from "./clientPairingRequestParsers.js";
import {
  checkPairingCreationRateLimit,
  checkPairingPollRateLimit,
} from "./clientPairingRateLimits.js";

export function createClientPairingRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();

  router.post("/", async (request, response, next) => {
    try {
      if (!checkPairingCreationRateLimit(request, response)) {
        return;
      }

      const body = readCreatePairingBody(request.body ?? {});

      if (typeof body === "string") {
        response.status(400).json({ error: body });
        return;
      }

      const pairing = await createNewClientPairingSession(pool, {
        pollIntervalSeconds: config.clientAuth.pairingPollIntervalSeconds,
        requestedName: body.name,
        softwareVersion: body.softwareVersion ?? null,
        ttlMinutes: config.clientAuth.pairingSessionTtlMinutes,
      });

      response.setHeader("Cache-Control", "no-store");
      response.status(201).json(pairing);
    } catch (error) {
      next(error);
    }
  });

  router.post("/poll", async (request, response, next) => {
    try {
      if (!checkPairingPollRateLimit(request, response)) {
        return;
      }

      const deviceCode = readPairingDeviceCode(request.body ?? {});

      if (!deviceCode) {
        response.status(400).json({ error: "Device code is invalid" });
        return;
      }

      const clientSecret = createClientSecret();
      const result = await activateClientPairing(pool, {
        clientId: randomUUID(),
        credentialHash: hashClientCredential(clientSecret),
        deviceCodeHash: hashClientCredential(deviceCode),
      });

      response.setHeader("Cache-Control", "no-store");

      switch (result.status) {
        case "approved":
          response.json({
            clientId: result.clientId,
            clientSecret,
            heartbeatIntervalSeconds: config.clientAuth.heartbeatIntervalSeconds,
            status: "approved",
          } satisfies ApprovedClientPairingResponse);
          return;
        case "pending":
          response.status(202).json({
            expiresAt: result.expiresAt.toISOString(),
            pollIntervalSeconds: result.pollIntervalSeconds,
            status: "pending",
          } satisfies PendingClientPairingResponse);
          return;
        case "slow_down":
          response.setHeader("Retry-After", String(result.retryAfterSeconds));
          response.status(429).json({ error: "Pairing was polled too quickly" });
          return;
        case "expired":
          response.json({ status: "expired" } satisfies TerminalClientPairingResponse);
          return;
        case "rejected":
          response.json({ status: "rejected" } satisfies TerminalClientPairingResponse);
          return;
        case "consumed":
          response.json({ status: "consumed" } satisfies TerminalClientPairingResponse);
          return;
        case "invalid":
          response.status(404).json({ error: "Pairing session was not found" });
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
