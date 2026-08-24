import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

type PairingDecisionResult = "approved" | "expired" | "group_not_found" | "unavailable";
type PairingRejectionResult = "expired" | "rejected" | "unavailable";

interface PairingDecisionRow extends RowDataPacket {
  expiresAt: Date;
  status: "approved" | "consumed" | "pending" | "rejected";
}

export interface ApproveClientPairingInput {
  adminUserId: string;
  groupId: string | null;
  name: string;
  pairingId: string;
}

export async function approveClientPairing(
  pool: Pool,
  input: ApproveClientPairingInput,
): Promise<PairingDecisionResult> {
  return withPairingDecision(pool, input.pairingId, async (connection, pairing) => {
    if (isExpired(pairing)) {
      return "expired";
    }

    if (pairing.status !== "pending") {
      return "unavailable";
    }

    if (input.groupId && !(await groupExists(connection, input.groupId))) {
      return "group_not_found";
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE client_pairing_sessions
        SET
          status = 'approved',
          approved_name = ?,
          approved_group_id = ?,
          approved_by_user_id = ?,
          approved_at = NOW(6)
        WHERE id = ?
          AND status = 'pending'
      `,
      [input.name, input.groupId, input.adminUserId, input.pairingId],
    );

    return "approved";
  });
}

export async function rejectClientPairing(
  pool: Pool,
  pairingId: string,
  adminUserId: string,
): Promise<PairingRejectionResult> {
  return withPairingDecision(pool, pairingId, async (connection, pairing) => {
    if (isExpired(pairing)) {
      return "expired";
    }

    if (pairing.status !== "pending") {
      return "unavailable";
    }

    await connection.execute<ResultSetHeader>(
      `
        UPDATE client_pairing_sessions
        SET
          status = 'rejected',
          rejected_by_user_id = ?,
          rejected_at = NOW(6)
        WHERE id = ?
          AND status = 'pending'
      `,
      [adminUserId, pairingId],
    );

    return "rejected";
  });
}

async function withPairingDecision<T>(
  pool: Pool,
  pairingId: string,
  decide: (connection: PoolConnection, pairing: PairingDecisionRow) => Promise<T>,
): Promise<T | "unavailable"> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const pairing = await findPairingForUpdate(connection, pairingId);

    if (!pairing) {
      await connection.rollback();
      return "unavailable";
    }

    const result = await decide(connection, pairing);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findPairingForUpdate(
  connection: PoolConnection,
  pairingId: string,
): Promise<PairingDecisionRow | null> {
  const [rows] = await connection.execute<PairingDecisionRow[]>(
    `
      SELECT status, expires_at AS expiresAt
      FROM client_pairing_sessions
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
    `,
    [pairingId],
  );

  return rows[0] ?? null;
}

async function groupExists(connection: PoolConnection, groupId: string): Promise<boolean> {
  const [rows] = await connection.execute<RowDataPacket[]>(
    "SELECT id FROM display_groups WHERE id = ? LIMIT 1",
    [groupId],
  );

  return rows.length > 0;
}

function isExpired(pairing: PairingDecisionRow): boolean {
  return pairing.expiresAt.getTime() <= Date.now();
}
