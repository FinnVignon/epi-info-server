import { Pool, RowDataPacket } from "mysql2/promise";

interface NamedLockRow extends RowDataPacket {
  lockAcquired: 0 | 1 | null;
}

export class MysqlNamedLockTimeoutError extends Error {
  constructor(lockName: string) {
    super(`Timed out waiting for MySQL lock: ${lockName}`);
  }
}

export async function withMysqlNamedLock<T>(
  pool: Pool,
  lockName: string,
  timeoutSeconds: number,
  callback: () => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  let lockAcquired = false;

  try {
    const [rows] = await connection.execute<NamedLockRow[]>(
      "SELECT GET_LOCK(?, ?) AS lockAcquired",
      [lockName, timeoutSeconds],
    );

    lockAcquired = rows[0]?.lockAcquired === 1;

    if (!lockAcquired) {
      throw new MysqlNamedLockTimeoutError(lockName);
    }

    return await callback();
  } finally {
    if (lockAcquired) {
      await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]);
    }

    connection.release();
  }
}
