import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import type { ErrorRequestHandler } from "express";
import multer from "multer";
import type { Pool } from "mysql2/promise";

import type { ServerConfig } from "../config.js";
import {
  createAsset,
  findAssetById,
  findAssetBySha256,
  isDuplicateEntryError,
  updateAssetStatus,
  type AssetWithStoragePath,
} from "../database.js";
import {
  AssetUploadValidationError,
  calculateSha256,
  getAssetMimeType,
  moveFile,
  removeFile,
  sanitizeOriginalFilename,
  validateAssetSignature,
} from "./assetFiles.js";
import type { Asset } from "../../../shared/adminContracts.js";

class AssetForbiddenError extends Error {}

export function createAssetUpload(storagePath: string, maxFileSizeBytes: number) {
  const tempStoragePath = path.join(path.resolve(storagePath), "tmp");

  return multer({
    fileFilter: (_request, file, callback) => {
      if (!getAssetMimeType(file.mimetype)) {
        callback(new AssetUploadValidationError("Only image and video uploads are supported"));
        return;
      }

      callback(null, true);
    },
    limits: {
      fileSize: maxFileSizeBytes,
      files: 1,
    },
    storage: multer.diskStorage({
      destination: (_request, _file, callback) => {
        void mkdir(tempStoragePath, { recursive: true })
          .then(() => callback(null, tempStoragePath))
          .catch((error: unknown) => callback(error as Error, tempStoragePath));
      },
      filename: (_request, _file, callback) => {
        callback(null, `${randomUUID()}.upload`);
      },
    }),
  });
}

export function createUploadErrorHandler(config: ServerConfig): ErrorRequestHandler {
  return (error, _request, response, next) => {
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        response.status(413).json({
          error: `Asset upload is too large. Maximum size is ${config.assetUploadMaxBytes} bytes`,
        });
        return;
      }

      response.status(400).json({ error: "Upload must include one asset file" });
      return;
    }

    if (error instanceof AssetUploadValidationError) {
      response.status(400).json({ error: error.message });
      return;
    }

    if (error instanceof AssetForbiddenError) {
      response.status(403).json({ error: error.message });
      return;
    }

    next(error);
  };
}

export function readAssetDisplayName(
  value: unknown,
  fallback: string,
): string | AssetUploadValidationError {
  const displayName =
    typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;

  if (displayName.length < 2) {
    return new AssetUploadValidationError("Asset name must be at least 2 characters");
  }

  return displayName.slice(0, 255);
}

export async function persistUploadedAsset(
  pool: Pool,
  config: ServerConfig,
  file: Express.Multer.File,
  input: {
    displayName: string;
    isSuperAdmin: boolean;
    uploadedByUserId: string;
  },
): Promise<Asset> {
  const assetMimeType = getAssetMimeType(file.mimetype);

  if (!assetMimeType) {
    await removeFile(file.path);
    throw new AssetUploadValidationError("Only image and video uploads are supported");
  }

  await validateAssetSignature(file.path, file.mimetype);

  const sha256 = await calculateSha256(file.path);
  const existingAsset = await findAssetBySha256(pool, sha256);

  if (existingAsset) {
    await removeFile(file.path);

    if (existingAsset.status === "archived") {
      const canRestoreExistingAsset =
        input.isSuperAdmin || existingAsset.uploadedBy?.id === input.uploadedByUserId;

      if (!canRestoreExistingAsset) {
        throw new AssetForbiddenError(
          "This file already exists as an archived asset managed by another admin",
        );
      }

      await updateAssetStatus(pool, { assetId: existingAsset.id, status: "active" });

      const restoredAsset = await findAssetById(pool, existingAsset.id);

      if (restoredAsset) {
        return safeAsset(restoredAsset);
      }
    }

    return safeAsset(existingAsset);
  }

  const assetId = randomUUID();
  const storagePath = path.join(
    path.resolve(config.assetStoragePath),
    `${sha256}${assetMimeType.extension}`,
  );

  await moveFile(file.path, storagePath);

  try {
    return await createAsset(pool, {
      displayName: input.displayName,
      id: assetId,
      mimeType: file.mimetype,
      originalFilename: sanitizeOriginalFilename(file.originalname),
      publicUrl: buildAssetPublicUrl(config.publicBaseUrl, assetId),
      sha256,
      sizeBytes: file.size,
      storagePath,
      type: assetMimeType.type,
      uploadedByUserId: input.uploadedByUserId,
    });
  } catch (error) {
    if (isDuplicateEntryError(error)) {
      const duplicatedAsset = await findAssetBySha256(pool, sha256);

      if (duplicatedAsset) {
        return safeAsset(duplicatedAsset);
      }
    }

    await removeFile(storagePath);
    throw error;
  }
}

export function canManageAssetStatus(
  asset: AssetWithStoragePath,
  userId: string,
  isSuperAdmin: boolean,
): boolean {
  return isSuperAdmin || asset.uploadedBy?.id === userId;
}

export function safeAsset(asset: AssetWithStoragePath): Asset {
  const { storagePath: _storagePath, ...safeAssetValue } = asset;

  return safeAssetValue;
}

function buildAssetPublicUrl(publicBaseUrl: string, assetId: string): string {
  return `${publicBaseUrl.replace(/\/+$/, "")}/media/assets/${encodeURIComponent(assetId)}`;
}
