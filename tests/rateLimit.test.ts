import { afterEach, describe, expect, it, vi } from "vitest";

import { createFixedWindowRateLimiter } from "../apps/api/src/auth/rateLimit.js";

describe("fixed-window rate limiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("blocks attempts above the configured limit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const limiter = createFixedWindowRateLimiter({ maxAttempts: 2, windowMs: 60_000 });

    expect(limiter.consume("login:one").allowed).toBe(true);
    expect(limiter.consume("login:one").allowed).toBe(true);
    expect(limiter.consume("login:one")).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
    });
    expect(limiter.consume("login:two").allowed).toBe(true);
  });

  it("starts a new window after the previous one expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const limiter = createFixedWindowRateLimiter({ maxAttempts: 1, windowMs: 1_000 });

    expect(limiter.consume("login:one").allowed).toBe(true);
    expect(limiter.consume("login:one").allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));
    expect(limiter.consume("login:one")).toEqual({
      allowed: true,
      retryAfterSeconds: 1,
    });
  });
});
