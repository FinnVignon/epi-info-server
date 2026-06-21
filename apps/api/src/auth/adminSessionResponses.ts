import { randomUUID } from "node:crypto";
import type { Pool } from "mysql2/promise";

import type { ServerConfig } from "../config.js";
import { createAdminSession, type AdminUserWithPasswordHash } from "../database.js";
import {
  createExpiredSessionCookieHeader,
  createSessionCookieHeader,
  createSessionExpiry,
  createSessionToken,
  hashSessionToken,
} from "./sessions.js";

export function safeAdminUser(user: AdminUserWithPasswordHash) {
  return {
    createdAt: user.createdAt,
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    isSuperAdmin: user.isSuperAdmin,
    lastLoginAt: user.lastLoginAt,
    status: user.status,
    updatedAt: user.updatedAt,
  };
}

export async function createAdminSessionResponse(
  pool: Pool,
  config: ServerConfig,
  userId: string,
): Promise<{ expiresAt: Date; token: string }> {
  const token = createSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = createSessionExpiry(config.adminAuth.sessionTtlHours);

  await createAdminSession(pool, {
    expiresAt,
    id: randomUUID(),
    tokenHash,
    userId,
  });

  return {
    expiresAt,
    token,
  };
}

export function setAdminSessionCookie(
  response: { setHeader(name: string, value: string): void },
  config: ServerConfig,
  token: string,
  expiresAt: Date,
): void {
  response.setHeader(
    "Set-Cookie",
    createSessionCookieHeader(token, {
      cookieName: config.adminAuth.sessionCookieName,
      expiresAt,
      isProduction: process.env.NODE_ENV === "production",
    }),
  );
}

export function clearAdminSessionCookie(
  response: { setHeader(name: string, value: string): void },
  config: ServerConfig,
): void {
  response.setHeader(
    "Set-Cookie",
    createExpiredSessionCookieHeader(
      config.adminAuth.sessionCookieName,
      process.env.NODE_ENV === "production",
    ),
  );
}
