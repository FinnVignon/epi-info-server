import type { Pool, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import type {
  Asset,
  AssetStatus,
  AssetType,
  AssetUploader,
} from "../../../shared/adminContracts.js";

interface AssetRow extends RowDataPacket {
  archivedAt: Date | null;
  createdAt: Date;
  displayName: string;
  id: string;
  mimeType: string;
  originalFilename: string;
  publicUrl: string;
  sha256: string;
  sizeBytes: number | string;
  status: AssetStatus;
  storagePath: string;
  type: AssetType;
  updatedAt: Date;
  uploadedByDisplayName: string | null;
  uploadedByEmail: string | null;
  uploadedById: string | null;
}

export interface AssetWithStoragePath extends Asset {
  storagePath: string;
}

export interface CreateAssetInput {
  displayName: string;
  id: string;
  mimeType: string;
  originalFilename: string;
  publicUrl: string;
  sha256: string;
  sizeBytes: number;
  storagePath: string;
  type: AssetType;
  uploadedByUserId: string;
}

export interface UpdateAssetStatusInput {
  assetId: string;
  status: AssetStatus;
}

const ASSET_SELECT_FIELDS = `
  assets.id,
  assets.display_name AS displayName,
  assets.type,
  assets.original_filename AS originalFilename,
  assets.mime_type AS mimeType,
  assets.size_bytes AS sizeBytes,
  assets.sha256,
  assets.storage_path AS storagePath,
  assets.public_url AS publicUrl,
  assets.status,
  assets.uploaded_by_user_id AS uploadedById,
  assets.archived_at AS archivedAt,
  assets.created_at AS createdAt,
  assets.updated_at AS updatedAt,
  admin_users.display_name AS uploadedByDisplayName,
  admin_users.email AS uploadedByEmail
`;

const ASSET_JOIN = `
  FROM assets
  LEFT JOIN admin_users ON admin_users.id = assets.uploaded_by_user_id
`;

export async function createAsset(pool: Pool, input: CreateAssetInput): Promise<Asset> {
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO assets (
        id,
        display_name,
        type,
        original_filename,
        mime_type,
        size_bytes,
        sha256,
        storage_path,
        public_url,
        uploaded_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      input.id,
      input.displayName,
      input.type,
      input.originalFilename,
      input.mimeType,
      input.sizeBytes,
      input.sha256,
      input.storagePath,
      input.publicUrl,
      input.uploadedByUserId,
    ],
  );

  const asset = await findAssetById(pool, input.id);

  if (!asset) {
    throw new Error("Created asset could not be loaded");
  }

  const { storagePath: _storagePath, ...safeAsset } = asset;

  return safeAsset;
}

export async function findAssetById(
  pool: Pool,
  assetId: string,
): Promise<AssetWithStoragePath | null> {
  return findAsset(pool, "assets.id", assetId);
}

export async function findAssetBySha256(
  pool: Pool,
  sha256: string,
): Promise<AssetWithStoragePath | null> {
  return findAsset(pool, "assets.sha256", sha256);
}

export async function listAssets(pool: Pool): Promise<Asset[]> {
  const [rows] = await pool.query<AssetRow[]>(
    `
      SELECT
        ${ASSET_SELECT_FIELDS}
      ${ASSET_JOIN}
      ORDER BY assets.created_at DESC
    `,
  );

  return rows.map((row) => {
    const { storagePath: _storagePath, ...asset } = mapAsset(row);

    return asset;
  });
}

export async function updateAssetStatus(
  pool: Pool,
  input: UpdateAssetStatusInput,
): Promise<boolean> {
  const [result] = await pool.execute<ResultSetHeader>(
    `
      UPDATE assets
      SET
        status = ?,
        archived_at = CASE WHEN ? = 'archived' THEN NOW() ELSE NULL END
      WHERE id = ?
    `,
    [input.status, input.status, input.assetId],
  );

  return result.affectedRows > 0;
}

async function findAsset(
  pool: Pool,
  column: "assets.id" | "assets.sha256",
  value: string,
): Promise<AssetWithStoragePath | null> {
  const [rows] = await pool.execute<AssetRow[]>(
    `
      SELECT
        ${ASSET_SELECT_FIELDS}
      ${ASSET_JOIN}
      WHERE ${column} = ?
      LIMIT 1
    `,
    [value],
  );

  return rows[0] ? mapAsset(rows[0]) : null;
}

function mapAsset(row: AssetRow): AssetWithStoragePath {
  return {
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    displayName: row.displayName,
    id: row.id,
    mimeType: row.mimeType,
    originalFilename: row.originalFilename,
    publicUrl: row.publicUrl,
    sha256: row.sha256,
    sizeBytes: Number(row.sizeBytes),
    status: row.status,
    storagePath: row.storagePath,
    type: row.type,
    updatedAt: row.updatedAt.toISOString(),
    uploadedBy: mapAssetUploader(row),
  };
}

function mapAssetUploader(row: AssetRow): AssetUploader | null {
  if (!row.uploadedById || !row.uploadedByDisplayName || !row.uploadedByEmail) {
    return null;
  }

  return {
    displayName: row.uploadedByDisplayName,
    email: row.uploadedByEmail,
    id: row.uploadedById,
  };
}
