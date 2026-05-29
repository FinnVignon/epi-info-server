import { NextFunction, Request, RequestHandler, Response } from "express";
import { Pool } from "mysql2/promise";

import {
  AdminSessionWithUser,
  findAdminSessionByTokenHash,
  touchAdminSession,
} from "../database.js";
import { readCookie } from "../http/cookies.js";
import { hashSessionToken } from "./sessions.js";

export interface AuthenticatedAdminRequest extends Request {
  adminSession: AdminSessionWithUser;
  adminSessionTokenHash: string;
}

export function createAdminAuthMiddleware(pool: Pool, cookieName: string): RequestHandler {
  return async (request: Request, response: Response, next: NextFunction) => {
    const token = readCookie(request.header("cookie"), cookieName);

    if (!token) {
      response.status(401).json({ error: "Admin authentication is required" });
      return;
    }

    try {
      const tokenHash = hashSessionToken(token);
      const session = await findAdminSessionByTokenHash(pool, tokenHash);

      if (!session) {
        response.status(401).json({ error: "Admin authentication is required" });
        return;
      }

      await touchAdminSession(pool, session.id);
      Object.assign(request, {
        adminSession: session,
        adminSessionTokenHash: tokenHash,
      });
      next();
    } catch (error) {
      next(error);
    }
  };
}
