import { rm } from "node:fs/promises";
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
    const deletedAsset = await deleteArchivedAssetIfEligible(
      pool,
      candidate.id,
      options.retentionDays,
    );

    if (!deletedAsset) {
      continue;
    }

    await deleteStoredAssetFile(deletedAsset);
    deletedAssetIds.push(deletedAsset.id);
  }

  return {
    deletedAssetIds,
    scannedCount: candidates.length,
  };
}

async function deleteStoredAssetFile(asset: ArchivedAssetCleanupCandidate): Promise<void> {
  try {
    await rm(asset.storagePath, { force: true });
  } catch (error) {
    console.error(
      `Archived asset ${asset.id} was removed from the database but its file could not be deleted: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
