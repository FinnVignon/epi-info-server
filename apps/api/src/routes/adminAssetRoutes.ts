import { Router } from "express";
import { Pool } from "mysql2/promise";

import type { AuthenticatedAdminRequest } from "../auth/adminAuth.js";
import { createAdminAuthMiddleware } from "../auth/adminAuth.js";
import { createRequireAnyAdminPermissionMiddleware } from "../auth/adminPermissions.js";
import { ServerConfig } from "../config.js";
import { findAssetById, listAssets, updateAssetStatus } from "../database.js";
import {
  AssetUploadValidationError,
  defaultDisplayName,
  removeFile,
} from "../services/assetFiles.js";
import {
  canManageAssetStatus,
  createAssetUpload,
  createUploadErrorHandler,
  persistUploadedAsset,
  readAssetDisplayName,
  safeAsset,
} from "../services/assetUploads.js";
import type { AssetStatus, UpdateAssetStatusRequest } from "../../../shared/adminContracts.js";

function readAssetStatusBody(body: Partial<UpdateAssetStatusRequest>): AssetStatus | string {
  if (body.status !== "active" && body.status !== "archived") {
    return "Status must be active or archived";
  }

  return body.status;
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
