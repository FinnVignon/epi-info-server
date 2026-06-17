import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { Pool } from "mysql2/promise";

import { findClientCredentialById } from "../database.js";

const CLIENT_SECRET_BYTES = 32;

export interface AuthenticatedClientRequest extends Request {
  clientIdentity: {
    id: string;
  };
}

export interface ClientCredentialAuthenticationInput {
  clientId: string | null | undefined;
  clientSecret: string | null | undefined;
}

export interface AuthenticatedClientIdentity {
  id: string;
}

export function createClientSecret(): string {
  return randomBytes(CLIENT_SECRET_BYTES).toString("base64url");
}

export function hashClientCredential(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createClientAuthMiddleware(pool: Pool): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    const clientId = request.header("x-client-id")?.trim();
    const clientSecret = readBearerToken(request.header("authorization"));

    if (!clientId || !clientSecret) {
      sendClientAuthenticationRequired(response);
      return;
    }

    try {
      const identity = await authenticateClientCredential(pool, { clientId, clientSecret });

      if (!identity) {
        sendClientAuthenticationRequired(response);
        return;
      }

      Object.assign(request, {
        clientIdentity: identity,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function authenticateClientCredential(
  pool: Pool,
  input: ClientCredentialAuthenticationInput,
): Promise<AuthenticatedClientIdentity | null> {
  const clientId = input.clientId?.trim();
  const clientSecret = input.clientSecret?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  const client = await findClientCredentialById(pool, clientId);

  if (
    !client ||
    client.accessStatus !== "active" ||
    !client.credentialHash ||
    !credentialHashesMatch(hashClientCredential(clientSecret), client.credentialHash)
  ) {
    return null;
  }

  return { id: client.id };
}

export function readBearerToken(authorization: string | undefined): string | null {
  if (!authorization) {
    return null;
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    return null;
  }

  return token;
}

function credentialHashesMatch(candidateHash: string, storedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(storedHash)) {
    return false;
  }

  return timingSafeEqual(Buffer.from(candidateHash, "hex"), Buffer.from(storedHash, "hex"));
}

function sendClientAuthenticationRequired(response: Response): void {
  response.status(401).json({ error: "Client authentication is required" });
}
