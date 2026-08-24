import type { Pool, ResultSetHeader } from "mysql2/promise";

export interface TemporaryRecordCleanupSummary {
  deletedEnrollmentTokens: number;
  deletedPairingSessions: number;
  deletedSessions: number;
}

export async function deleteExpiredTemporaryRecords(
  pool: Pool,
  usedEnrollmentTokenRetentionDays: number,
): Promise<TemporaryRecordCleanupSummary> {
  const [sessionResult] = await pool.execute<ResultSetHeader>(
    "DELETE FROM admin_sessions WHERE expires_at <= NOW()",
  );
  const [enrollmentTokenResult] = await pool.execute<ResultSetHeader>(
    `
      DELETE FROM client_enrollment_tokens
      WHERE expires_at <= NOW()
        OR (
          used_at IS NOT NULL
          AND used_at <= DATE_SUB(NOW(), INTERVAL ? DAY)
        )
    `,
    [usedEnrollmentTokenRetentionDays],
  );
  const [pairingSessionResult] = await pool.execute<ResultSetHeader>(
    "DELETE FROM client_pairing_sessions WHERE expires_at <= NOW(6)",
  );

  return {
    deletedEnrollmentTokens: enrollmentTokenResult.affectedRows,
    deletedPairingSessions: pairingSessionResult.affectedRows,
    deletedSessions: sessionResult.affectedRows,
  };
}
