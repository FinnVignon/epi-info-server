import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { listMigrationFiles } from "../apps/api/src/database/migrations.js";

describe("database migration discovery", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { force: true, recursive: true })),
    );
  });

  it("returns only valid migration files in deterministic order", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "epi-info-migrations-"));
    temporaryDirectories.push(directory);
    await Promise.all([
      writeFile(path.join(directory, "010_later.sql"), "SELECT 10;"),
      writeFile(path.join(directory, "002_middle.sql"), "SELECT 2;"),
      writeFile(path.join(directory, "001_initial.sql"), "SELECT 1;"),
      writeFile(path.join(directory, "notes.md"), "ignored"),
      writeFile(path.join(directory, "003 invalid.sql"), "SELECT 3;"),
      mkdir(path.join(directory, "004_directory.sql")),
    ]);

    await expect(listMigrationFiles(directory)).resolves.toEqual([
      "001_initial.sql",
      "002_middle.sql",
      "010_later.sql",
    ]);
  });
});
