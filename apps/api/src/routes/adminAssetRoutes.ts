import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, open as openFile, rm, rename } from "node:fs/promises";
import path from "node:path";
import { Router, type ErrorRequestHandler } from "express";
import multer from "multer";
import { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { createRequireAnyAdminPermissionMiddleware } from "../auth/adminPermissions.js";
import { ServerConfig } from "../config.js";
import {
  createAsset,
  findAssetById,
  findAssetBySha256,
  listAssets,
  updateAssetStatus,
  type AssetWithStoragePath,
} from "../database.js";
import type {
  Asset,
  AssetStatus,
  AssetType,
  UpdateAssetStatusRequest,
} from "../../../shared/adminContracts.js";

interface SupportedAssetMimeType {
  extension: string;
  type: AssetType;
}

const SUPPORTED_ASSET_MIME_TYPES = new Map<string, SupportedAssetMimeType>([
  ["image/avif", { extension: ".avif", type: "image" }],
  ["image/gif", { extension: ".gif", type: "image" }],
  ["image/jpeg", { extension: ".jpg", type: "image" }],
  ["image/png", { extension: ".png", type: "image" }],
  ["image/webp", { extension: ".webp", type: "image" }],
  ["video/mp4", { extension: ".mp4", type: "video" }],
  ["video/ogg", { extension: ".ogv", type: "video" }],
  ["video/quicktime", { extension: ".mov", type: "video" }],
  ["video/webm", { extension: ".webm", type: "video" }],
]);

class AssetUploadValidationError extends Error {}
class AssetForbiddenError extends Error {}

function getAssetMimeType(mimeType: string): SupportedAssetMimeType | null {
  return SUPPORTED_ASSET_MIME_TYPES.get(mimeType) ?? null;
}

function createAssetUpload(storagePath: string, maxFileSizeBytes: number) {
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

function createUploadErrorHandler(config: ServerConfig): ErrorRequestHandler {
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

function sanitizeOriginalFilename(originalName: string): string {
  const filename = path.basename(originalName.replace(/\\/g, "/")).replace(/\0/g, "").trim();

  return filename.slice(0, 255) || "asset";
}

function defaultDisplayName(originalFilename: string): string {
  const filename = sanitizeOriginalFilename(originalFilename);
  const parsedFilename = path.parse(filename);

  return (parsedFilename.name || filename).slice(0, 255);
}

function readAssetDisplayName(
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

function readAssetStatusBody(body: Partial<UpdateAssetStatusRequest>): AssetStatus | string {
  if (body.status !== "active" && body.status !== "archived") {
    return "Status must be active or archived";
  }

  return body.status;
}

function buildAssetPublicUrl(publicBaseUrl: string, assetId: string): string {
  return `${publicBaseUrl.replace(/\/+$/, "")}/media/assets/${encodeURIComponent(assetId)}`;
}

function safeAsset(asset: AssetWithStoragePath): Asset {
  const { storagePath: _storagePath, ...safeAssetValue } = asset;

  return safeAssetValue;
}

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function readFileHeader(filePath: string, byteLength: number): Promise<Buffer> {
  const fileHandle = await openFile(filePath, "r");
  const buffer = Buffer.alloc(byteLength);

  try {
    const result = await fileHandle.read(buffer, 0, byteLength, 0);

    return buffer.subarray(0, result.bytesRead);
  } finally {
    await fileHandle.close();
  }
}

async function validateAssetSignature(filePath: string, mimeType: string): Promise<void> {
  const header = await readFileHeader(filePath, 64);

  if (!doesFileSignatureMatchMimeType(header, mimeType)) {
    throw new AssetUploadValidationError("Uploaded file content does not match its file type");
  }
}

function doesFileSignatureMatchMimeType(header: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "image/avif":
      return hasIsoBmffBrand(header, ["avif", "avis", "mif1", "msf1"]);
    case "image/gif":
      return startsWithAscii(header, "GIF87a") || startsWithAscii(header, "GIF89a");
    case "image/jpeg":
      return startsWithBytes(header, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return startsWithAscii(header, "RIFF") && header.subarray(8, 12).toString("ascii") === "WEBP";
    case "video/mp4":
      return hasIsoBmffBrand(header, ["avc1", "dash", "isom", "iso2", "mp41", "mp42"]);
    case "video/ogg":
      return startsWithAscii(header, "OggS");
    case "video/quicktime":
      return hasIsoBmffBrand(header, ["qt  "]);
    case "video/webm":
      return startsWithBytes(header, [0x1a, 0x45, 0xdf, 0xa3]);
    default:
      return false;
  }
}

function startsWithAscii(buffer: Buffer, expected: string): boolean {
  return buffer.subarray(0, expected.length).toString("ascii") === expected;
}

function startsWithBytes(buffer: Buffer, expected: number[]): boolean {
  if (buffer.length < expected.length) {
    return false;
  }

  return expected.every((byte, index) => buffer[index] === byte);
}

function hasIsoBmffBrand(buffer: Buffer, expectedBrands: string[]): boolean {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") {
    return false;
  }

  for (let index = 8; index + 4 <= buffer.length; index += 4) {
    const brand = buffer.subarray(index, index + 4).toString("ascii");

    if (expectedBrands.includes(brand)) {
      return true;
    }
  }

  return false;
}

async function moveFile(sourcePath: string, destinationPath: string): Promise<void> {
  await mkdir(path.dirname(destinationPath), { recursive: true });

  try {
    await rename(sourcePath, destinationPath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EXDEV") {
      await copyFile(sourcePath, destinationPath);
      await rm(sourcePath, { force: true });
      return;
    }

    throw error;
  }
}

async function removeFile(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
}

function isDuplicateAssetError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY"
  );
}

async function persistUploadedAsset(
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
    if (isDuplicateAssetError(error)) {
      const duplicatedAsset = await findAssetBySha256(pool, sha256);

      if (duplicatedAsset) {
        return safeAsset(duplicatedAsset);
      }
    }

    await removeFile(storagePath);
    throw error;
  }
}

function canManageAssetStatus(
  asset: AssetWithStoragePath,
  userId: string,
  isSuperAdmin: boolean,
): boolean {
  return isSuperAdmin || asset.uploadedBy?.id === userId;
}

export function createAdminAssetRouter(pool: Pool, config: ServerConfig): Router {
  const router = Router();
  const requireAdminAuth = createAdminAuthMiddleware(pool, config.adminAuth.sessionCookieName);
  const requireManageContent = createRequireAnyAdminPermissionMiddleware(pool, "manage_content");
  const upload = createAssetUpload(config.assetStoragePath, config.assetUploadMaxBytes);

  router.use(requireAdminAuth, requireManageContent);

  router.get("/", async (_request, response, next) => {
    try {
      response.json({
        assets: await listAssets(pool),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", upload.single("asset"), async (request, response, next) => {
    try {
      if (!request.file) {
        response.status(400).json({ error: "Asset file is required" });
        return;
      }

      const adminRequest = request as unknown as AuthenticatedAdminRequest;
      const displayName = readAssetDisplayName(
        (request.body as { displayName?: unknown }).displayName,
        defaultDisplayName(request.file.originalname),
      );

      if (displayName instanceof AssetUploadValidationError) {
        response.status(400).json({ error: displayName.message });
        return;
      }

      response.status(201).json({
        asset: await persistUploadedAsset(pool, config, request.file, {
          displayName,
          isSuperAdmin: adminRequest.adminSession.user.isSuperAdmin,
          uploadedByUserId: adminRequest.adminSession.user.id,
        }),
      });
    } catch (error) {
      if (request.file) {
        await removeFile(request.file.path);
      }

      next(error);
    }
  });

  router.patch("/:assetId/status", async (request, response, next) => {
    try {
      const assetId =
        typeof request.params.assetId === "string" && request.params.assetId.length > 0
          ? request.params.assetId
          : null;

      if (!assetId) {
        response.status(400).json({ error: "Asset id is required" });
        return;
      }

      const status = readAssetStatusBody((request.body ?? {}) as Partial<UpdateAssetStatusRequest>);

      if (typeof status === "string") {
        response.status(400).json({ error: status });
        return;
      }

      const asset = await findAssetById(pool, assetId);

      if (!asset) {
        response.status(404).json({ error: "Asset was not found" });
        return;
      }

      const adminRequest = request as unknown as AuthenticatedAdminRequest;

      if (
        !canManageAssetStatus(
          asset,
          adminRequest.adminSession.user.id,
          adminRequest.adminSession.user.isSuperAdmin,
        )
      ) {
        response.status(403).json({
          error: "Only the uploader or a super admin can archive or restore this asset",
        });
        return;
      }

      await updateAssetStatus(pool, { assetId, status });
      const updatedAsset = await findAssetById(pool, assetId);

      if (!updatedAsset) {
        response.status(404).json({ error: "Asset was not found" });
        return;
      }

      response.json({ asset: safeAsset(updatedAsset) });
    } catch (error) {
      next(error);
    }
  });

  router.use(createUploadErrorHandler(config));

  return router;
}
