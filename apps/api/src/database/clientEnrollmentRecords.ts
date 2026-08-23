import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

interface EnrollmentTokenRow extends RowDataPacket {
  expiresAt: Date;
  id: string;
  usedAt: Date | null;
}

export interface CreateClientEnrollmentTokenInput {
  createdByUserId: string;
  expiresAt: Date;
  id: string;
  tokenHash: string;
}

export interface RegisterClientInput {
  clientId: string;
  credentialHash: string;
  enrollmentTokenHash: string;
  name: string;
  softwareVersion: string | null;
}

export type RegisterClientResult =
  | {
      clientId: string;
      status: "created";
    }
  | {
      status: "invalid";
    };

export async function createClientEnrollmentToken(
  pool: Pool,
  input: CreateClientEnrollmentTokenInput,
): Promise<void> {
  await pool.execute<ResultSetHeader>(
    `
      INSERT INTO client_enrollment_tokens (
        id,
        token_hash,
        created_by_user_id,
        expires_at
      )
      VALUES (?, ?, ?, ?)
    `,
    [input.id, input.tokenHash, input.createdByUserId, input.expiresAt],
  );
}

export async function registerClientWithEnrollmentToken(
  pool: Pool,
  input: RegisterClientInput,
): Promise<RegisterClientResult> {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const token = await findEnrollmentTokenForUpdate(connection, input.enrollmentTokenHash);

    if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now()) {
      await connection.rollback();
      return { status: "invalid" };
    }

    await createClient(connection, input);
    await consumeEnrollmentToken(connection, token.id, input.clientId);
    await connection.commit();

    return { clientId: input.clientId, status: "created" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createClient(connection: PoolConnection, input: RegisterClientInput): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      INSERT INTO clients (
        id,
        name,
        status,
        access_status,
        credential_hash,
        software_version,
        last_seen_at
      )
      VALUES (?, ?, 'online', 'active', ?, ?, NOW())
    `,
    [input.clientId, input.name, input.credentialHash, input.softwareVersion],
  );
}

async function consumeEnrollmentToken(
  connection: PoolConnection,
  tokenId: string,
  clientId: string,
): Promise<void> {
  await connection.execute<ResultSetHeader>(
    `
      UPDATE client_enrollment_tokens
      SET used_at = NOW(), used_by_client_id = ?
      WHERE id = ? AND used_at IS NULL
    `,
    [clientId, tokenId],
  );
}

async function findEnrollmentTokenForUpdate(
  connection: PoolConnection,
  tokenHash: string,
): Promise<EnrollmentTokenRow | null> {
  const [rows] = await connection.execute<EnrollmentTokenRow[]>(
    `
      SELECT id, expires_at AS expiresAt, used_at AS usedAt
      FROM client_enrollment_tokens
      WHERE token_hash = ?
      LIMIT 1
      FOR UPDATE
    `,
    [tokenHash],
  );

  return rows[0] ?? null;
}
