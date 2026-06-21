import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { Pool } from "mysql2/promise";
import { WebSocket, WebSocketServer } from "ws";

import { authenticateClientCredential, readBearerToken } from "../auth/clientCredentials.js";
import { listActiveClientIdsForAssignmentTarget } from "../database.js";
import type { AssignmentTarget } from "../database.js";
import type { ClientLiveEvent } from "../../../shared/clientContracts.js";

const CLIENT_LIVE_PATH = "/api/clients/live";

export interface ClientLiveUpdateHub {
  attach(server: Server): void;
  notifyAssignmentChanged(target: AssignmentTarget): Promise<void>;
}

export function createClientLiveUpdateHub(pool: Pool): ClientLiveUpdateHub {
  const webSocketServer = new WebSocketServer({ noServer: true });
  const socketsByClientId = new Map<string, Set<WebSocket>>();

  return {
    attach(server: Server): void {
      server.on("upgrade", (request, socket, head) => {
        if (readUpgradePath(request) !== CLIENT_LIVE_PATH) {
          socket.destroy();
          return;
        }

        void handleUpgrade(request, socket, head);
      });
    },

    async notifyAssignmentChanged(target: AssignmentTarget): Promise<void> {
      const clientIds = await listActiveClientIdsForAssignmentTarget(pool, target);

      for (const clientId of clientIds) {
        notifyClient(clientId);
      }
    },
  };

  async function handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): Promise<void> {
    try {
      const identity = await authenticateClientCredential(pool, {
        clientId: readHeader(request, "x-client-id"),
        clientSecret: readBearerToken(readHeader(request, "authorization") ?? undefined),
      });

      if (!identity) {
        rejectUpgrade(socket);
        return;
      }

      webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        registerSocket(identity.id, webSocket);
        sendEvent(webSocket, {
          serverTime: new Date().toISOString(),
          service: "epi-info-server",
          type: "server.hello",
        });
      });
    } catch (error) {
      console.warn(
        `Client live-update authentication failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      rejectUpgrade(socket);
    }
  }

  function registerSocket(clientId: string, socket: WebSocket): void {
    const clientSockets = socketsByClientId.get(clientId) ?? new Set<WebSocket>();

    clientSockets.add(socket);
    socketsByClientId.set(clientId, clientSockets);

    socket.on("close", () => removeSocket(clientId, socket));
    socket.on("error", () => removeSocket(clientId, socket));
  }

  function removeSocket(clientId: string, socket: WebSocket): void {
    const clientSockets = socketsByClientId.get(clientId);

    if (!clientSockets) {
      return;
    }

    clientSockets.delete(socket);

    if (clientSockets.size === 0) {
      socketsByClientId.delete(clientId);
    }
  }

  function notifyClient(clientId: string): void {
    const clientSockets = socketsByClientId.get(clientId);

    if (!clientSockets) {
      return;
    }

    for (const socket of clientSockets) {
      sendEvent(socket, {
        clientId,
        sentAt: new Date().toISOString(),
        type: "assignment.changed",
      });
    }
  }
}

function sendEvent(socket: WebSocket, event: ClientLiveEvent): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(event));
  }
}

function readHeader(request: IncomingMessage, name: string): string | null {
  const value = request.headers[name.toLowerCase()];

  return typeof value === "string" ? value : null;
}

function readUpgradePath(request: IncomingMessage): string | null {
  if (!request.url) {
    return null;
  }

  return new URL(request.url, "http://localhost").pathname;
}

function rejectUpgrade(socket: Duplex): void {
  socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
  socket.destroy();
}
