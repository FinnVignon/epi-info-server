import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createConnection, type RowDataPacket } from "mysql2/promise";

import type { ServerConfig } from "../config.js";

const MIGRATION_FILENAME_PATTERN = /^\d+_[a-z0-9_-]+\.sql$/i;

interface AppliedMigrationRow extends RowDataPacket {
  checksum: string;
  filename: string;
}

export interface DatabaseMigrationSummary {
  applied: string[];
  current: string[];
}

export async function runDatabaseMigrations(
  mysql: ServerConfig["mysql"],
  migrationsPath: string,
): Promise<DatabaseMigrationSummary> {
  const migrationFiles = await listMigrationFiles(migrationsPath);

  if (migrationFiles.length === 0) {
    throw new Error(`No database migrations found in ${path.resolve(migrationsPath)}`);
  }

  const connection = await createConnection({
    ...(mysql.socketPath
      ? { socketPath: mysql.socketPath }
      : {
          host: mysql.host,
          port: mysql.port,
        }),
    database: mysql.database,
    multipleStatements: true,
    password: mysql.password,
    user: mysql.user,
  });

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename VARCHAR(255) PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await connection.query<AppliedMigrationRow[]>(
      "SELECT filename, checksum FROM schema_migrations ORDER BY filename",
    );
    const appliedMigrations = new Map(rows.map((row) => [row.filename, row.checksum]));
    const applied: string[] = [];
    const current: string[] = [];

    for (const filename of migrationFiles) {
      const sql = await readFile(path.join(migrationsPath, filename), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const appliedChecksum = appliedMigrations.get(filename);

      if (appliedChecksum) {
        if (appliedChecksum !== checksum) {
          throw new Error(`Applied database migration ${filename} has been modified`);
        }

        current.push(filename);
        continue;
      }

      await connection.query(sql);
      await connection.execute("INSERT INTO schema_migrations (filename, checksum) VALUES (?, ?)", [
        filename,
        checksum,
      ]);
      applied.push(filename);
    }

    return { applied, current };
  } finally {
    await connection.end();
  }
}

export async function listMigrationFiles(migrationsPath: string): Promise<string[]> {
  const entries = await readdir(migrationsPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && MIGRATION_FILENAME_PATTERN.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}
