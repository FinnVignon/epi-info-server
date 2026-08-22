import type { NextFunction, Response } from "express";

import type { AssetWithStoragePath } from "../database.js";
import { resolveExistingAssetStoragePath } from "../services/assetStoragePaths.js";

export async function sendStoredAsset(
  response: Response,
  next: NextFunction,
  asset: AssetWithStoragePath,
  cacheVisibility: "private" | "public",
  assetStoragePath: string,
): Promise<void> {
  const storedAssetPath = await resolveExistingAssetStoragePath(
    assetStoragePath,
    asset.storagePath,
  );

  if (!storedAssetPath) {
    response.status(404).json({ error: "Asset file was not found" });
    return;
  }

  response.setHeader("Cache-Control", `${cacheVisibility}, max-age=31536000, immutable`);
  response.setHeader("Content-Type", asset.mimeType);
  response.setHeader("ETag", `"${asset.sha256}"`);
  response.sendFile(storedAssetPath, (error) => {
    if (error) {
      next(error);
    }
  });
}
