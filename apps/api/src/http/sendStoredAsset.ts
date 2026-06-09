import { access } from "node:fs/promises";
import path from "node:path";
import type { NextFunction, Response } from "express";

import type { AssetWithStoragePath } from "../database.js";

export async function sendStoredAsset(
  response: Response,
  next: NextFunction,
  asset: AssetWithStoragePath,
  cacheVisibility: "private" | "public",
): Promise<void> {
  try {
    await access(asset.storagePath);
  } catch {
    response.status(404).json({ error: "Asset file was not found" });
    return;
  }

  response.setHeader("Cache-Control", `${cacheVisibility}, max-age=31536000, immutable`);
  response.setHeader("Content-Type", asset.mimeType);
  response.setHeader("ETag", `"${asset.sha256}"`);
  response.sendFile(path.resolve(asset.storagePath), (error) => {
    if (error) {
      next(error);
    }
  });
}
