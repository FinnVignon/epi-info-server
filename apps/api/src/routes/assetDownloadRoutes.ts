import { Router } from "express";
import { Pool } from "mysql2/promise";

import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { findAssetById } from "../database.js";
import { sendStoredAsset } from "../http/sendStoredAsset.js";

function readAssetId(params: { assetId?: string }): string | null {
  return typeof params.assetId === "string" && params.assetId.length > 0 ? params.assetId : null;
}

export function createAssetDownloadRouter(pool: Pool, sessionCookieName: string): Router {
  const router = Router();

  router.use(createAdminAuthMiddleware(pool, sessionCookieName));

  router.get("/:assetId", async (request, response, next) => {
    try {
      const assetId = readAssetId(request.params);

      if (!assetId) {
        response.status(400).json({ error: "Asset id is required" });
        return;
      }

      const asset = await findAssetById(pool, assetId);

      if (!asset) {
        response.status(404).json({ error: "Asset was not found" });
        return;
      }

      await sendStoredAsset(response, next, asset, "private");
    } catch (error) {
      next(error);
    }
  });

  return router;
}
