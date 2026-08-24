import type { Pool, ResultSetHeader } from "mysql2/promise";

export interface TemporaryRecordCleanupSummary {
  deletedPairingSessions: number;
  deletedSessions: number;
}

export async function deleteExpiredTemporaryRecords(
  pool: Pool,
): Promise<TemporaryRecordCleanupSummary> {
  const [sessionResult] = await pool.execute<ResultSetHeader>(
    "DELETE FROM admin_sessions WHERE expires_at <= NOW()",
  );
  const [pairingSessionResult] = await pool.execute<ResultSetHeader>(
    "DELETE FROM client_pairing_sessions WHERE expires_at <= NOW(6)",
  );

  return {
    deletedPairingSessions: pairingSessionResult.affectedRows,
    deletedSessions: sessionResult.affectedRows,
  };
}
