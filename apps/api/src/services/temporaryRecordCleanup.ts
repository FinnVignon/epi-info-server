import type { Pool } from "mysql2/promise";

import { deleteExpiredTemporaryRecords } from "../database.js";
import { startPeriodicTask } from "./periodicTask.js";

export interface TemporaryRecordCleanupOptions {
  intervalHours: number;
  usedEnrollmentTokenRetentionDays: number;
}

export function startTemporaryRecordCleanup(
  pool: Pool,
  options: TemporaryRecordCleanupOptions,
): () => void {
  return startPeriodicTask({
    intervalMs: options.intervalHours * 60 * 60 * 1000,
    name: "Temporary database record cleanup",
    task: async () => {
      const summary = await deleteExpiredTemporaryRecords(
        pool,
        options.usedEnrollmentTokenRetentionDays,
      );
      const deletedCount = summary.deletedEnrollmentTokens + summary.deletedSessions;

      if (deletedCount > 0) {
        console.info(
          `Deleted ${summary.deletedSessions} expired admin session(s) and ${summary.deletedEnrollmentTokens} expired or old enrollment token(s)`,
        );
      }
    },
  });
}
