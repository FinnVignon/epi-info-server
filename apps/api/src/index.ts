import cors from "cors";
import express from "express";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createPool } from "mysql2/promise";
import { WebSocketServer } from "ws";

import { readConfig } from "./config.js";
import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../shared/contracts.js";

const config = readConfig();
const app = express();
const mysqlPool = createPool({
  database: config.mysql.database,
  host: config.mysql.host,
  password: config.mysql.password,
  port: config.mysql.port,
  user: config.mysql.user,
  waitForConnections: true,
  connectionLimit: 5,
});

mkdirSync(config.assetStoragePath, { recursive: true });

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_request, response) => {
  let database = "ok";

  try {
    const connection = await mysqlPool.getConnection();
    await connection.ping();
    connection.release();
  } catch (error) {
    database = "unavailable";
  }

  response.status(database === "ok" ? 200 : 503).json({
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

