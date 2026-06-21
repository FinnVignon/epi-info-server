import type { Request, Response } from "express";

import { normalizeAdminEmail } from "../auth/adminCredentials.js";
import {
  createFixedWindowRateLimiter,
  getRequestRateLimitKey,
  sendRateLimitResponse,
} from "../auth/rateLimit.js";

const bootstrapRateLimiter = createFixedWindowRateLimiter({
  maxAttempts: 5,
  windowMs: 5 * 60 * 1000,
});

const loginEmailRateLimiter = createFixedWindowRateLimiter({
  maxAttempts: 10,
  windowMs: 5 * 60 * 1000,
});

const loginIpRateLimiter = createFixedWindowRateLimiter({
  maxAttempts: 20,
  windowMs: 5 * 60 * 1000,
});

export function checkBootstrapRateLimit(request: Request, response: Response): boolean {
  const result = bootstrapRateLimiter.consume(getRequestRateLimitKey(request, "admin-bootstrap"));

  if (!result.allowed) {
    sendRateLimitResponse(response, result);
    return false;
  }

  return true;
}

export function checkLoginRateLimit(request: Request, response: Response, email: unknown): boolean {
  const ipResult = loginIpRateLimiter.consume(getRequestRateLimitKey(request, "admin-login"));

  if (!ipResult.allowed) {
    sendRateLimitResponse(response, ipResult);
    return false;
  }

  if (typeof email === "string" && email.trim().length > 0) {
    const emailResult = loginEmailRateLimiter.consume(
      `admin-login-email:${normalizeAdminEmail(email)}`,
    );

    if (!emailResult.allowed) {
      sendRateLimitResponse(response, emailResult);
      return false;
    }
  }

  return true;
}
