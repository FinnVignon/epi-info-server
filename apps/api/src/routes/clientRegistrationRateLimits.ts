import type { Request, Response } from "express";

import {
  createFixedWindowRateLimiter,
  getRequestRateLimitKey,
  sendRateLimitResponse,
} from "../auth/rateLimit.js";

const registrationRateLimiter = createFixedWindowRateLimiter({
  maxAttempts: 10,
  windowMs: 5 * 60 * 1000,
});

export function checkRegistrationRateLimit(request: Request, response: Response): boolean {
  const result = registrationRateLimiter.consume(
    getRequestRateLimitKey(request, "client-registration"),
  );

  if (!result.allowed) {
    sendRateLimitResponse(response, result);
    return false;
  }

  return true;
}
