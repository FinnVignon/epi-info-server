import cors from "cors";
import express from "express";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";

import { createAdminAuthMiddleware } from "./auth/adminAuth.js";
import { readConfig } from "./config.js";
import {
  checkDatabaseHealth,
  createDatabasePool,
  ensureAssetSchema,
  ensureClientConnectionSchema,
  getDashboardSummary,
} from "./database.js";
import { createAdminAuthRouter } from "./routes/adminAuthRoutes.js";
import { createAdminAssetRouter } from "./routes/adminAssetRoutes.js";
import { createAdminClientRouter } from "./routes/adminClientRoutes.js";
import { createAdminClientEnrollmentRouter } from "./routes/adminClientEnrollmentRoutes.js";
import { createAdminUserRouter } from "./routes/adminUserRoutes.js";
import { createAssetDownloadRouter } from "./routes/assetDownloadRoutes.js";
import { createClientConnectionRouter } from "./routes/clientConnectionRoutes.js";
import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../shared/contracts.js";

const config = readConfig();
const app = express();
const mysqlPool = createDatabasePool(config.mysql);
const requireAdminAuth = createAdminAuthMiddleware(mysqlPool, config.adminAuth.sessionCookieName);

mkdirSync(config.assetStoragePath, { recursive: true });

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_request, response) => {
  const database = await checkDatabaseHealth(mysqlPool, config.mysql.database);

  response.status(database.status === "ok" ? 200 : 503).json({
    database,
    service: "epi-info-server",
    supportedManifestItemTypes: SUPPORTED_MANIFEST_ITEM_TYPES,
  });
});

app.get("/api/config", (_request, response) => {
  response.json({
    publicBaseUrl: config.publicBaseUrl,
    supportedManifestItemTypes: SUPPORTED_MANIFEST_ITEM_TYPES,
  });
});

app.get("/api/dashboard", requireAdminAuth, async (_request, response) => {
  try {
    response.json(await getDashboardSummary(mysqlPool, config.clientAuth.offlineAfterSeconds));
  } catch (error) {
    response.status(503).json({
      error: error instanceof Error ? error.message : "Unable to load dashboard summary",
    });
  }
});

app.use("/media/assets", createAssetDownloadRouter(mysqlPool));
app.use("/api/admin/assets", createAdminAssetRouter(mysqlPool, config));
app.use("/api/admin/clients", createAdminClientRouter(mysqlPool, config));
app.use(
  "/api/admin/client-enrollment-tokens",
  createAdminClientEnrollmentRouter(mysqlPool, config),
);
app.use("/api/admin/users", createAdminUserRouter(mysqlPool, config));
app.use("/api/admin", createAdminAuthRouter(mysqlPool, config));
app.use("/api/clients", createClientConnectionRouter(mysqlPool, config));

if (config.adminDistPath) {
  const adminDistPath = path.resolve(config.adminDistPath);

  app.use(express.static(adminDistPath));
  app.get("*", (request, response, next) => {
    if (request.path.startsWith("/api")) {
      next();
      return;
    }

    response.sendFile(path.join(adminDistPath, "index.html"));
  });
}

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    response.status(500).json({ error: "Internal server error" });
  },
);

async function startServer(): Promise<void> {
  await ensureAssetSchema(mysqlPool, config.mysql.database);
  await ensureClientConnectionSchema(mysqlPool, config.mysql.database);

  const httpServer = app.listen(config.port, () => {
    console.log(`Epi Info server listening on port ${config.port}`);
  });

  const webSocketServer = new WebSocketServer({ server: httpServer, path: "/ws" });

  webSocketServer.on("connection", (socket) => {
    socket.send(
      JSON.stringify({
        service: "epi-info-server",
        type: "server.hello",
      }),
    );
  });
}

void startServer().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
