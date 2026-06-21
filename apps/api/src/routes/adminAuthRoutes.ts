import { randomUUID } from "node:crypto";
import { Router } from "express";
import { Pool } from "mysql2/promise";

import { AuthenticatedAdminRequest, createAdminAuthMiddleware } from "../auth/adminAuth.js";
import {
  clearAdminSessionCookie,
  createAdminSessionResponse,
  safeAdminUser,
  setAdminSessionCookie,
} from "../auth/adminSessionResponses.js";
import { hashAdminPassword, verifyAdminPassword } from "../auth/passwords.js";
import { ServerConfig } from "../config.js";
import {
  countAdminUsers,
  createAdminUser,
  deleteAdminSession,
  findAdminUserByEmail,
  MysqlNamedLockTimeoutError,
  updateAdminLastLogin,
  withMysqlNamedLock,
} from "../database.js";
import type { BootstrapBody, LoginBody } from "./adminAuthRequestParsers.js";
import { readBootstrapBody, readLoginBody } from "./adminAuthRequestParsers.js";
import { checkBootstrapRateLimit, checkLoginRateLimit } from "./adminAuthRateLimits.js";

const ADMIN_BOOTSTRAP_LOCK_NAME = "epi-info:admin-bootstrap";
const ADMIN_BOOTSTRAP_LOCK_TIMEOUT_SECONDS = 10;

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
      if (!checkBootstrapRateLimit(request, response)) {
        return;
      }

      const body = readBootstrapBody((request.body ?? {}) as BootstrapBody);

      if (typeof body === "string") {
        response.status(400).json({ error: body });
        return;
      }

      const bootstrap = await withMysqlNamedLock(
        pool,
        ADMIN_BOOTSTRAP_LOCK_NAME,
        ADMIN_BOOTSTRAP_LOCK_TIMEOUT_SECONDS,
        async () => {
          if ((await countAdminUsers(pool)) > 0) {
            return null;
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

          return {
            session,
            user,
          };
        },
      );

      if (!bootstrap) {
        response.status(409).json({ error: "Admin bootstrap has already been completed" });
        return;
      }

      setAdminSessionCookie(response, config, bootstrap.session.token, bootstrap.session.expiresAt);
      response.status(201).json({
        session: {
          expiresAt: bootstrap.session.expiresAt.toISOString(),
        },
        user: bootstrap.user,
      });
    } catch (error) {
      if (error instanceof MysqlNamedLockTimeoutError) {
        response.status(503).json({ error: "Admin bootstrap is already in progress" });
        return;
      }

      next(error);
    }
  });

  router.post("/login", async (request, response, next) => {
    try {
      const requestBody = (request.body ?? {}) as LoginBody;

      if (!checkLoginRateLimit(request, response, requestBody.email)) {
        return;
      }

      const body = readLoginBody(requestBody);

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
      setAdminSessionCookie(response, config, session.token, session.expiresAt);
      response.json({
        session: {
          expiresAt: session.expiresAt.toISOString(),
        },
        user: safeAdminUser(user),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/logout", requireAdminAuth, async (request, response, next) => {
    try {
      const adminRequest = request as AuthenticatedAdminRequest;

      await deleteAdminSession(pool, adminRequest.adminSessionTokenHash);
      clearAdminSessionCookie(response, config);
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
