import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import type { Pool } from "mysql2/promise";

import {
  type AuthenticatedClientRequest,
  createClientAuthMiddleware,
  createClientSecret,
  hashClientCredential,
} from "../auth/clientCredentials.js";
import {
  createFixedWindowRateLimiter,
  getRequestRateLimitKey,
  sendRateLimitResponse,
} from "../auth/rateLimit.js";
import type { ServerConfig } from "../config.js";
import { recordClientHeartbeat, registerClientWithEnrollmentToken } from "../database.js";
import type {
  ClientHeartbeatRequest,
  ClientHeartbeatResponse,
  RegisterClientRequest,
  RegisterClientResponse,
} from "../../../shared/clientContracts.js";

const registrationRateLimiter = createFixedWindowRateLimiter({
  maxAttempts: 10,
  windowMs: 5 * 60 * 1000,
});

export function createClientConnectionRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireClientAuth = createClientAuthMiddleware(pool);

  router.post("/register", async (request, response, next) => {
    try {
      if (!checkRegistrationRateLimit(request, response)) {
        return;
      }

      const body = readRegistrationBody((request.body ?? {}) as Partial<RegisterClientRequest>);

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
      const heartbeat = readHeartbeatBody((request.body ?? {}) as Partial<ClientHeartbeatRequest>);

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

function checkRegistrationRateLimit(request: Request, response: Response): boolean {
  const result = registrationRateLimiter.consume(
    getRequestRateLimitKey(request, "client-registration"),
  );

  if (!result.allowed) {
    sendRateLimitResponse(response, result);
    return false;
  }

  return true;
}

function readRegistrationBody(
  body: Partial<RegisterClientRequest>,
): RegisterClientRequest | string {
  if (typeof body.enrollmentToken !== "string" || body.enrollmentToken.length < 32) {
    return "A valid enrollment token is required";
  }

  if (body.enrollmentToken.length > 512) {
    return "Enrollment token is too long";
  }

  if (typeof body.name !== "string" || body.name.trim().length < 2) {
    return "Client name must be at least 2 characters";
  }

  const name = body.name.trim();

  if (name.length > 255) {
    return "Client name must not exceed 255 characters";
  }

  const softwareVersion = readOptionalText(body.softwareVersion, 64, "Software version");

  if ("error" in softwareVersion) {
    return softwareVersion.error;
  }

  return {
    enrollmentToken: body.enrollmentToken,
    name,
    ...(softwareVersion.value ? { softwareVersion: softwareVersion.value } : {}),
  };
}

function readHeartbeatBody(body: Partial<ClientHeartbeatRequest>): ClientHeartbeatRequest | string {
  const currentManifestId = readNullableText(body.currentManifestId, 64, "Current manifest id");

  if ("error" in currentManifestId) {
    return currentManifestId.error;
  }

  if (
    body.currentManifestVersion !== undefined &&
    body.currentManifestVersion !== null &&
    (!Number.isSafeInteger(body.currentManifestVersion) || body.currentManifestVersion < 0)
  ) {
    return "Current manifest version must be a non-negative integer or null";
  }

  const softwareVersion = readOptionalText(body.softwareVersion, 64, "Software version");
  const lastSyncResult = readNullableText(body.lastSyncResult, 255, "Last sync result");
  const lastError = readNullableText(body.lastError, 4000, "Last error");

  if ("error" in softwareVersion) {
    return softwareVersion.error;
  }

  if ("error" in lastSyncResult) {
    return lastSyncResult.error;
  }

  if ("error" in lastError) {
    return lastError.error;
  }

  return {
    currentManifestId: currentManifestId.value,
    currentManifestVersion: body.currentManifestVersion,
    lastError: lastError.value,
    lastSyncResult: lastSyncResult.value,
    ...(softwareVersion.value ? { softwareVersion: softwareVersion.value } : {}),
  };
}

type TextValidationResult<T> =
  | {
      error: string;
    }
  | {
      value: T;
    };

function readOptionalText(
  value: unknown,
  maxLength: number,
  label: string,
): TextValidationResult<string | undefined> {
  if (value === undefined) {
    return { value: undefined };
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return { error: `${label} must be a non-empty string` };
  }

  const normalizedValue = value.trim();

  return normalizedValue.length <= maxLength
    ? { value: normalizedValue }
    : { error: `${label} must not exceed ${maxLength} characters` };
}

function readNullableText(
  value: unknown,
  maxLength: number,
  label: string,
): TextValidationResult<string | null | undefined> {
  if (value === undefined) {
    return { value: undefined };
  }

  if (value === null) {
    return { value: null };
  }

  if (typeof value !== "string") {
    return { error: `${label} must be a string or null` };
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length > maxLength) {
    return { error: `${label} must not exceed ${maxLength} characters` };
  }

  return { value: normalizedValue || null };
}
