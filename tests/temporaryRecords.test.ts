import type { Pool } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import { deleteExpiredTemporaryRecords } from "../apps/api/src/database/temporaryRecords.js";

describe("temporary database record cleanup", () => {
  it("deletes expired sessions and expired or old enrollment tokens", async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce([{ affectedRows: 3 }])
      .mockResolvedValueOnce([{ affectedRows: 5 }]);
    const pool = { execute } as unknown as Pool;

    await expect(deleteExpiredTemporaryRecords(pool, 30)).resolves.toEqual({
      deletedEnrollmentTokens: 5,
      deletedSessions: 3,
    });
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[0]?.[0]).toContain("DELETE FROM admin_sessions");
    expect(execute.mock.calls[1]?.[0]).toContain("DELETE FROM client_enrollment_tokens");
    expect(execute.mock.calls[1]?.[1]).toEqual([30]);
  });
});
