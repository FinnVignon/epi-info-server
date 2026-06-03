import type { Request, Response } from "express";

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitEntry {
  attempts: number;
  resetAt: number;
}

export function createFixedWindowRateLimiter(options: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();
  let lastCleanupAt = 0;

  function consume(key: string): RateLimitResult {
    const now = Date.now();

    if (now - lastCleanupAt > options.windowMs) {
      cleanupExpiredEntries(now);
      lastCleanupAt = now;
    }

    const currentEntry = entries.get(key);
    const entry =
      currentEntry && currentEntry.resetAt > now
        ? currentEntry
        : {
            attempts: 0,
            resetAt: now + options.windowMs,
          };

    entry.attempts += 1;
    entries.set(key, entry);

    return {
      allowed: entry.attempts <= options.maxAttempts,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  return {
    consume,
  };

  function cleanupExpiredEntries(now: number): void {
    for (const [entryKey, entry] of entries) {
      if (entry.resetAt <= now) {
        entries.delete(entryKey);
      }
    }
  }
}

export function getRequestRateLimitKey(request: Request, scope: string): string {
  const remoteAddress = request.ip || request.socket.remoteAddress || "unknown";

  return `${scope}:${remoteAddress}`;
}

export function sendRateLimitResponse(response: Response, result: RateLimitResult): void {
  response.setHeader("Retry-After", String(result.retryAfterSeconds));
  response.status(429).json({ error: "Too many attempts. Try again later." });
}
