import type { Request, Response } from "express";

import {
  createFixedWindowRateLimiter,
  getRequestRateLimitKey,
  sendRateLimitResponse,
} from "../auth/rateLimit.js";

const creationLimiter = createFixedWindowRateLimiter({
  maxAttempts: 5,
  windowMs: 10 * 60 * 1000,
});
const pollingLimiter = createFixedWindowRateLimiter({
  maxAttempts: 150,
  windowMs: 10 * 60 * 1000,
});
const lookupSourceLimiter = createFixedWindowRateLimiter({
  maxAttempts: 20,
  windowMs: 10 * 60 * 1000,
});
const lookupCodeLimiter = createFixedWindowRateLimiter({
  maxAttempts: 5,
  windowMs: 10 * 60 * 1000,
});

export function checkPairingCreationRateLimit(request: Request, response: Response): boolean {
  return consumeSourceLimit(request, response, creationLimiter, "client-pairing-create");
}

export function checkPairingPollRateLimit(request: Request, response: Response): boolean {
  return consumeSourceLimit(request, response, pollingLimiter, "client-pairing-poll");
}

export function checkPairingLookupRateLimit(
  request: Request,
  response: Response,
  userCodeHash: string,
): boolean {
  const sourceResult = lookupSourceLimiter.consume(
    getRequestRateLimitKey(request, "client-pairing-lookup"),
  );
  const codeResult = lookupCodeLimiter.consume(`client-pairing-code:${userCodeHash}`);
  const blockedResult = !sourceResult.allowed
    ? sourceResult
    : !codeResult.allowed
      ? codeResult
      : null;

  if (blockedResult) {
    sendRateLimitResponse(response, blockedResult);
    return false;
  }

  return true;
}

function consumeSourceLimit(
  request: Request,
  response: Response,
  limiter: ReturnType<typeof createFixedWindowRateLimiter>,
  scope: string,
): boolean {
  const result = limiter.consume(getRequestRateLimitKey(request, scope));

  if (!result.allowed) {
    sendRateLimitResponse(response, result);
    return false;
  }

  return true;
}
