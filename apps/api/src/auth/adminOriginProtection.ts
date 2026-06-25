import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { ServerConfig } from "../config.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DEVELOPMENT_ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function createAdminOriginProtectionMiddleware(config: ServerConfig): RequestHandler {
  const allowedOrigins = new Set([
    ...normalizeOrigins(config.adminAuth.allowedOrigins),
    ...normalizeOrigins([config.publicBaseUrl]),
    ...(process.env.NODE_ENV === "production" ? [] : DEVELOPMENT_ALLOWED_ORIGINS),
  ]);

  return (request: Request, response: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(request.method.toUpperCase())) {
      next();
      return;
    }

    const requestOrigin = readRequestOrigin(request);

    if (!requestOrigin) {
      rejectRequest(response);
      return;
    }

    if (allowedOrigins.has(requestOrigin) || isSameHostOrigin(requestOrigin, request)) {
      next();
      return;
    }

    rejectRequest(response);
  };
}

function normalizeOrigins(origins: string[]): string[] {
  return origins
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => origin !== null);
}

function normalizeOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function readRequestOrigin(request: Request): string | null {
  const originHeader = request.header("origin");

  if (originHeader !== undefined) {
    return normalizeOrigin(originHeader);
  }

  return normalizeOrigin(request.header("referer"));
}

function isSameHostOrigin(origin: string, request: Request): boolean {
  const host = request.header("host");

  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function rejectRequest(response: Response): void {
  response.status(403).json({ error: "Admin request origin is not allowed" });
}
