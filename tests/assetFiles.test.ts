import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  AssetUploadValidationError,
  defaultDisplayName,
  sanitizeOriginalFilename,
  validateAssetSignature,
} from "../apps/api/src/services/assetFiles.js";
import { prepareAssetFileDeletion } from "../apps/api/src/services/assetCleanup.js";

describe("asset file validation", () => {
  const temporaryDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { force: true, recursive: true })),
    );
  });

  it("accepts a file whose signature matches its MIME type", async () => {
    const filePath = await createTemporaryFile(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    await expect(validateAssetSignature(filePath, "image/png")).resolves.toBeUndefined();
  });

  it("rejects a file whose signature does not match its MIME type", async () => {
    const filePath = await createTemporaryFile(Buffer.from("not an image"));

    await expect(validateAssetSignature(filePath, "image/png")).rejects.toBeInstanceOf(
      AssetUploadValidationError,
    );
  });

  it("removes path components and null bytes from uploaded names", () => {
    expect(sanitizeOriginalFilename("../folder\\unsafe\0name.png")).toBe("unsafename.png");
    expect(defaultDisplayName("../folder/photo.png")).toBe("photo");
  });

  it("restores an archived file when deletion is rolled back", async () => {
    const filePath = await createTemporaryFile(Buffer.from("asset"));
    const deletion = await prepareAssetFileDeletion({ id: "asset-1", storagePath: filePath });

    await expect(access(filePath)).rejects.toThrow();
    await deletion.rollback();
    await expect(access(filePath)).resolves.toBeUndefined();
  });

  it("removes an archived file only when deletion is committed", async () => {
    const filePath = await createTemporaryFile(Buffer.from("asset"));
    const deletion = await prepareAssetFileDeletion({ id: "asset-1", storagePath: filePath });

    await deletion.commit();
    await expect(access(filePath)).rejects.toThrow();
  });

  async function createTemporaryFile(contents: Buffer): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "epi-info-asset-"));
    const filePath = path.join(directory, "upload");
    temporaryDirectories.push(directory);
    await writeFile(filePath, contents);

    return filePath;
  }
});
