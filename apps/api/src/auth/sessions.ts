import { createHash, randomBytes } from "node:crypto";

export interface SessionCookieOptions {
  cookieName: string;
  expiresAt: Date;
  isProduction: boolean;
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSessionExpiry(ttlHours: number): Date {
  return new Date(Date.now() + ttlHours * 60 * 60 * 1000);
}

export function createSessionCookieHeader(token: string, options: SessionCookieOptions): string {
  const parts = [
    `${options.cookieName}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Expires=${options.expiresAt.toUTCString()}`,
  ];

  if (options.isProduction) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

export function createExpiredSessionCookieHeader(
  cookieName: string,
  isProduction: boolean,
): string {
  const parts = [
    `${cookieName}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (isProduction) {
    parts.push("Secure");
  }

  return parts.join("; ");
}
