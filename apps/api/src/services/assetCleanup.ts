import { randomUUID } from "node:crypto";
import { rename, rm } from "node:fs/promises";
import type { Pool } from "mysql2/promise";

import {
  deleteArchivedAssetIfEligible,
  listArchivedAssetCleanupCandidates,
  type ArchivedAssetCleanupCandidate,
} from "../database.js";

export interface ArchivedAssetCleanupOptions {
  intervalHours: number;
  retentionDays: number;
}

export interface ArchivedAssetCleanupSummary {
  deletedAssetIds: string[];
  scannedCount: number;
}

export interface PreparedAssetFileDeletion {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export function startArchivedAssetCleanup(
  pool: Pool,
  options: ArchivedAssetCleanupOptions,
): () => void {
  let isRunning = false;
  const intervalMs = options.intervalHours * 60 * 60 * 1000;

  async function runOnce(): Promise<void> {
    if (isRunning) {
      return;
    }

    isRunning = true;

    try {
      const summary = await runArchivedAssetCleanup(pool, options);

      if (summary.deletedAssetIds.length > 0) {
        console.info(
          `Deleted ${summary.deletedAssetIds.length} archived asset(s): ${summary.deletedAssetIds.join(", ")}`,
        );
      }
    } catch (error) {
      console.error(
        `Archived asset cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      isRunning = false;
    }
  }

  void runOnce();
  const timer = setInterval(() => void runOnce(), intervalMs);

  return () => clearInterval(timer);
}

export async function runArchivedAssetCleanup(
  pool: Pool,
  options: ArchivedAssetCleanupOptions,
): Promise<ArchivedAssetCleanupSummary> {
  const candidates = await listArchivedAssetCleanupCandidates(pool, options.retentionDays);
  const deletedAssetIds: string[] = [];

  for (const candidate of candidates) {
    const preparedFileDeletion = await prepareAssetFileDeletion(candidate);
    let databaseRecordDeleted = false;

    try {
      const deletedAsset = await deleteArchivedAssetIfEligible(
        pool,
        candidate.id,
        options.retentionDays,
      );

      if (!deletedAsset) {
        await preparedFileDeletion.rollback();
        continue;
      }

      databaseRecordDeleted = true;
      await preparedFileDeletion.commit();
      deletedAssetIds.push(deletedAsset.id);
    } catch (error) {
      if (!databaseRecordDeleted) {
        await preparedFileDeletion.rollback();
      }

      throw error;
    }
  }

  return {
    deletedAssetIds,
    scannedCount: candidates.length,
  };
}

export async function prepareAssetFileDeletion(
  asset: ArchivedAssetCleanupCandidate,
): Promise<PreparedAssetFileDeletion> {
  const quarantinePath = `${asset.storagePath}.deleting-${randomUUID()}`;
  let quarantined = false;

  try {
    await rename(asset.storagePath, quarantinePath);
    quarantined = true;
  } catch (error) {
    if (!hasErrorCode(error, "ENOENT")) {
      throw error;
    }
  }

  return {
    async commit(): Promise<void> {
      if (quarantined) {
        await rm(quarantinePath, { force: true });
        quarantined = false;
      }
    },

    async rollback(): Promise<void> {
      if (quarantined) {
        await rename(quarantinePath, asset.storagePath);
        quarantined = false;
      }
    },
  };
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
