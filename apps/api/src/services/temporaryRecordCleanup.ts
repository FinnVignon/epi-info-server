import type { Pool } from "mysql2/promise";

import { deleteExpiredTemporaryRecords } from "../database.js";
import { startPeriodicTask } from "./periodicTask.js";

export interface TemporaryRecordCleanupOptions {
  intervalHours: number;
}

export function startTemporaryRecordCleanup(
  pool: Pool,
  options: TemporaryRecordCleanupOptions,
): () => void {
  return startPeriodicTask({
    intervalMs: options.intervalHours * 60 * 60 * 1000,
    name: "Temporary database record cleanup",
    task: async () => {
      const summary = await deleteExpiredTemporaryRecords(pool);
      const totalDeletedCount = summary.deletedSessions + summary.deletedPairingSessions;

      if (totalDeletedCount > 0) {
        console.info(
          `Deleted ${summary.deletedSessions} expired admin session(s) and ${summary.deletedPairingSessions} expired pairing session(s)`,
        );
      }
    },
  });
}
