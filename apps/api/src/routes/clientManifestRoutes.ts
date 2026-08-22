import { Router } from "express";
import type { Pool } from "mysql2/promise";

import {
  type AuthenticatedClientRequest,
  createClientAuthMiddleware,
} from "../auth/clientCredentials.js";
import { findAssetById, findEffectiveManifestForClient } from "../database.js";
import { sendStoredAsset } from "../http/sendStoredAsset.js";
import type { EffectiveManifestResponse } from "../../../shared/clientContracts.js";

interface ClientAssetRouteParams {
  assetId?: string;
}

export function createClientManifestRouter(pool: Pool, assetStoragePath: string): Router {
  const router = Router();
  const requireClientAuth = createClientAuthMiddleware(pool);

  router.use(requireClientAuth);

  router.get("/manifest", async (request, response, next) => {
    try {
      const clientRequest = request as unknown as AuthenticatedClientRequest;
      const manifest = await findEffectiveManifestForClient(pool, clientRequest.clientIdentity.id);

      response.setHeader("Cache-Control", "no-store");
      response.json({ manifest } satisfies EffectiveManifestResponse);
    } catch (error) {
      next(error);
    }
  });

  router.get("/assets/:assetId", async (request, response, next) => {
    try {
      const assetId = readAssetId(request.params);

      if (!assetId) {
        response.status(400).json({ error: "Asset id is required" });
        return;
      }

      const clientRequest = request as unknown as AuthenticatedClientRequest;
      const manifest = await findEffectiveManifestForClient(pool, clientRequest.clientIdentity.id);
      const isAssigned = manifest?.items.some(
        (item) => (item.type === "image" || item.type === "video") && item.assetId === assetId,
      );

      if (!isAssigned) {
        response.status(404).json({ error: "Assigned asset was not found" });
        return;
      }

      const asset = await findAssetById(pool, assetId);

      if (!asset) {
        response.status(404).json({ error: "Assigned asset was not found" });
        return;
      }

      await sendStoredAsset(response, next, asset, "private", assetStoragePath);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function readAssetId(params: ClientAssetRouteParams): string | null {
  return typeof params.assetId === "string" && params.assetId.length > 0 ? params.assetId : null;
}
