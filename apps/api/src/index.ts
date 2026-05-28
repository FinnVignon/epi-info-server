import cors from "cors";
import express from "express";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { WebSocketServer } from "ws";

import { readConfig } from "./config.js";
import { checkDatabaseHealth, createDatabasePool, getDashboardSummary } from "./database.js";
import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../shared/contracts.js";

const config = readConfig();
const app = express();
const mysqlPool = createDatabasePool(config.mysql);

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

app.get("/api/dashboard", async (_request, response) => {
  try {
    response.json(await getDashboardSummary(mysqlPool));
  } catch (error) {
    response.status(503).json({
      error: error instanceof Error ? error.message : "Unable to load dashboard summary",
    });
  }
});

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
