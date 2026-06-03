import { access } from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { Pool } from "mysql2/promise";

import { findAssetById } from "../database.js";

function readAssetId(params: { assetId?: string }): string | null {
  return typeof params.assetId === "string" && params.assetId.length > 0 ? params.assetId : null;
}

export function createAssetDownloadRouter(pool: Pool): Router {
  const router = Router();

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

      try {
        await access(asset.storagePath);
      } catch {
        response.status(404).json({ error: "Asset file was not found" });
        return;
      }

      response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      response.setHeader("Content-Type", asset.mimeType);
      response.sendFile(path.resolve(asset.storagePath), (error) => {
        if (error) {
          next(error);
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
