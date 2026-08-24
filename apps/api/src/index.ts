import express from "express";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { createAdminAuthMiddleware } from "./auth/adminAuth.js";
import type { AuthenticatedAdminRequest } from "./auth/adminAuth.js";
import { createAdminOriginProtectionMiddleware } from "./auth/adminOriginProtection.js";
import { readConfig } from "./config.js";
import {
  checkDatabaseHealth,
  createDatabasePool,
  ensureAssignmentContentSchema,
  ensureAssignmentSchema,
  ensureAssetSchema,
  ensureClientConnectionSchema,
  getDashboardSummary,
} from "./database.js";
import { createClientLiveUpdateHub } from "./live/clientLiveUpdateHub.js";
import { createAdminAuthRouter } from "./routes/adminAuthRoutes.js";
import { createAdminAssetRouter } from "./routes/adminAssetRoutes.js";
import { createAdminAssignmentRouter } from "./routes/adminAssignmentRoutes.js";
import { createAdminClientRouter } from "./routes/adminClientRoutes.js";
import { createAdminClientPairingRouter } from "./routes/adminClientPairingRoutes.js";
import { createAdminGroupRouter } from "./routes/adminGroupRoutes.js";
import { createAdminUserRouter } from "./routes/adminUserRoutes.js";
import { createAssetDownloadRouter } from "./routes/assetDownloadRoutes.js";
import { createClientConnectionRouter } from "./routes/clientConnectionRoutes.js";
import { createClientPairingRouter } from "./routes/clientPairingRoutes.js";
import { createClientManifestRouter } from "./routes/clientManifestRoutes.js";
import { startArchivedAssetCleanup } from "./services/assetCleanup.js";
import { startTemporaryRecordCleanup } from "./services/temporaryRecordCleanup.js";
import { runDatabaseMigrations } from "./database/migrations.js";
import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../shared/contracts.js";

const config = readConfig();
const app = express();
const mysqlPool = createDatabasePool(config.mysql);
const requireAdminAuth = createAdminAuthMiddleware(mysqlPool, config.adminAuth.sessionCookieName);
const clientLiveUpdates = createClientLiveUpdateHub(mysqlPool);

mkdirSync(config.assetStoragePath, { recursive: true });

app.use(express.json());
app.use("/api/admin", createAdminOriginProtectionMiddleware(config));

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

app.get("/api/dashboard", requireAdminAuth, async (request, response) => {
  try {
    const adminRequest = request as AuthenticatedAdminRequest;

    response.json(
      await getDashboardSummary(mysqlPool, {
        isSuperAdmin: adminRequest.adminSession.user.isSuperAdmin,
        offlineAfterSeconds: config.clientAuth.offlineAfterSeconds,
        userId: adminRequest.adminSession.user.id,
      }),
    );
  } catch (error) {
    response.status(503).json({
      error: error instanceof Error ? error.message : "Unable to load dashboard summary",
    });
  }
});

app.use(
  "/media/assets",
  createAssetDownloadRouter(mysqlPool, {
    assetStoragePath: config.assetStoragePath,
    sessionCookieName: config.adminAuth.sessionCookieName,
  }),
);
app.use("/api/admin/assets", createAdminAssetRouter(mysqlPool, config));
app.use(
  "/api/admin/assignments",
  createAdminAssignmentRouter(mysqlPool, config, clientLiveUpdates),
);
app.use("/api/admin/clients", createAdminClientRouter(mysqlPool, config));
app.use("/api/admin/client-pairings", createAdminClientPairingRouter(mysqlPool, config));
app.use("/api/admin/groups", createAdminGroupRouter(mysqlPool, config));
app.use("/api/admin/users", createAdminUserRouter(mysqlPool, config));
app.use("/api/admin", createAdminAuthRouter(mysqlPool, config));
app.use("/api/clients", createClientConnectionRouter(mysqlPool, config));
app.use("/api/clients/pairing-sessions", createClientPairingRouter(mysqlPool, config));
app.use("/api/clients", createClientManifestRouter(mysqlPool, config.assetStoragePath));

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
  const migrations = await runDatabaseMigrations(config.mysql, config.databaseMigrationsPath);

  if (migrations.applied.length > 0) {
    console.info(`Applied database migration(s): ${migrations.applied.join(", ")}`);
  }

  await ensureAssignmentSchema(mysqlPool, config.mysql.database);
  await ensureAssignmentContentSchema(mysqlPool, config.mysql.database);
  await ensureAssetSchema(mysqlPool, config.mysql.database);
  await ensureClientConnectionSchema(mysqlPool, config.mysql.database);
  const stopBackgroundTasks = [
    startArchivedAssetCleanup(mysqlPool, {
      ...config.assetCleanup,
      assetStoragePath: config.assetStoragePath,
    }),
    startTemporaryRecordCleanup(mysqlPool, config.temporaryRecordCleanup),
  ];

  const httpServer = app.listen(config.port, () => {
    console.log(`Epi Info server listening on port ${config.port}`);
  });

  clientLiveUpdates.attach(httpServer);
  let isShuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.info(`Received ${signal}; shutting down Epi Info server`);
    const forcedShutdown = setTimeout(() => {
      console.error("Server shutdown timed out");
      process.exit(1);
    }, 10_000);

    forcedShutdown.unref();

    for (const stopTask of stopBackgroundTasks) {
      stopTask();
    }

    clientLiveUpdates.close();

    try {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
      await mysqlPool.end();
      clearTimeout(forcedShutdown);
      console.info("Epi Info server stopped");
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  }

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

void startServer().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
