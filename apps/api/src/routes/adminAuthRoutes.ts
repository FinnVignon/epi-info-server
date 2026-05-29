import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Pool } from "mysql2/promise";

import { AuthenticatedAdminRequest, createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { hashAdminPassword, isValidAdminPassword, verifyAdminPassword } from "../auth/passwords.js";
import {
  createExpiredSessionCookieHeader,
  createSessionCookieHeader,
  createSessionExpiry,
  createSessionToken,
  hashSessionToken,
} from "../auth/sessions.js";
import { ServerConfig } from "../config.js";
import {
  AdminUserWithPasswordHash,
  countAdminUsers,
  createAdminSession,
  createAdminUser,
  deleteAdminSession,
  findAdminUserByEmail,
  updateAdminLastLogin,
} from "../database.js";

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

interface BootstrapBody extends LoginBody {
  displayName?: unknown;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function readLoginBody(body: LoginBody): { email: string; password: string } | string {
  if (typeof body.email !== "string" || typeof body.password !== "string") {
    return "Email and password are required";
  }

  const email = normalizeEmail(body.email);

  if (!isValidEmail(email)) {
    return "A valid email is required";
  }

  if (!isValidAdminPassword(body.password)) {
    return "Password must be at least 10 characters";
  }

  return {
    email,
    password: body.password,
  };
}

function readBootstrapBody(
  body: BootstrapBody,
): { displayName: string; email: string; password: string } | string {
  const loginBody = readLoginBody(body);

  if (typeof loginBody === "string") {
    return loginBody;
  }

  if (typeof body.displayName !== "string" || body.displayName.trim().length < 2) {
    return "Display name must be at least 2 characters";
  }

  return {
    ...loginBody,
    displayName: body.displayName.trim(),
  };
}

function safeUser(user: AdminUserWithPasswordHash) {
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

async function createAdminSessionResponse(
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

function setSessionCookie(
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

export function createAdminAuthRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireAdminAuth = createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName);

  router.get("/bootstrap/status", async (_request, response, next) => {
    try {
      response.json({
        needsBootstrap: (await countAdminUsers(pool)) === 0,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/bootstrap", async (request, response, next) => {
    try {
      if ((await countAdminUsers(pool)) > 0) {
        response.status(409).json({ error: "Admin bootstrap has already been completed" });
        return;
      }

      const body = readBootstrapBody(request.body as BootstrapBody);

      if (typeof body === "string") {
        response.status(400).json({ error: body });
        return;
      }

      const user = await createAdminUser(pool, {
        displayName: body.displayName,
        email: body.email,
        id: randomUUID(),
        isSuperAdmin: true,
        passwordHash: await hashAdminPassword(body.password, {
          bcryptRounds: config.adminAuth.passwordBcryptRounds,
        }),
      });
      const session = await createAdminSessionResponse(pool, config, user.id);

      await updateAdminLastLogin(pool, user.id);
      setSessionCookie(response, config, session.token, session.expiresAt);
      response.status(201).json({
        session: {
          expiresAt: session.expiresAt.toISOString(),
        },
        user,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (request, response, next) => {
    try {
      const body = readLoginBody(request.body as LoginBody);

      if (typeof body === "string") {
        response.status(400).json({ error: body });
        return;
      }

      const user = await findAdminUserByEmail(pool, body.email);

      if (!user || user.status !== "active") {
        response.status(401).json({ error: "Invalid email or password" });
        return;
      }

      if (!(await verifyAdminPassword(body.password, user.passwordHash))) {
        response.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const session = await createAdminSessionResponse(pool, config, user.id);

      await updateAdminLastLogin(pool, user.id);
      setSessionCookie(response, config, session.token, session.expiresAt);
      response.json({
        session: {
          expiresAt: session.expiresAt.toISOString(),
        },
        user: safeUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", requireAdminAuth, async (request, response, next) => {
    try {
      const adminRequest = request as AuthenticatedAdminRequest;

      await deleteAdminSession(pool, adminRequest.adminSessionTokenHash);
      response.setHeader(
        "Set-Cookie",
        createExpiredSessionCookieHeader(
          config.adminAuth.sessionCookieName,
          process.env.NODE_ENV === "production",
        ),
      );
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAdminAuth, (request, response) => {
    const adminRequest = request as AuthenticatedAdminRequest;

    response.json({
      session: {
        expiresAt: adminRequest.adminSession.expiresAt,
        id: adminRequest.adminSession.id,
      },
      user: adminRequest.adminSession.user,
    });
  });

  return router;
}
