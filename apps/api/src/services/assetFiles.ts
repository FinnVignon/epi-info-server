import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, open as openFile, rm, rename } from "node:fs/promises";
import path from "node:path";

import type { AssetType } from "../../../shared/adminContracts.js";

export interface SupportedAssetMimeType {
  extension: string;
  type: AssetType;
}

export class AssetUploadValidationError extends Error {}

const SUPPORTED_ASSET_MIME_TYPES = new Map<string, SupportedAssetMimeType>([
  ["image/avif", { extension: ".avif", type: "image" }],
  ["image/gif", { extension: ".gif", type: "image" }],
  ["image/jpeg", { extension: ".jpg", type: "image" }],
  ["image/png", { extension: ".png", type: "image" }],
  ["image/webp", { extension: ".webp", type: "image" }],
  ["video/mp4", { extension: ".mp4", type: "video" }],
  ["video/ogg", { extension: ".ogv", type: "video" }],
  ["video/quicktime", { extension: ".mov", type: "video" }],
  ["video/webm", { extension: ".webm", type: "video" }],
]);

export function getAssetMimeType(mimeType: string): SupportedAssetMimeType | null {
  return SUPPORTED_ASSET_MIME_TYPES.get(mimeType) ?? null;
}

export function sanitizeOriginalFilename(originalName: string): string {
  const filename = path.basename(originalName.replace(/\\/g, "/")).replace(/\0/g, "").trim();

  return filename.slice(0, 255) || "asset";
}

export function defaultDisplayName(originalFilename: string): string {
  const filename = sanitizeOriginalFilename(originalFilename);
  const parsedFilename = path.parse(filename);

  return (parsedFilename.name || filename).slice(0, 255);
}

export async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");

  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

export async function validateAssetSignature(filePath: string, mimeType: string): Promise<void> {
  const header = await readFileHeader(filePath, 64);

  if (!doesFileSignatureMatchMimeType(header, mimeType)) {
    throw new AssetUploadValidationError("Uploaded file content does not match its file type");
  }
}

export async function moveFile(sourcePath: string, destinationPath: string): Promise<void> {
  await mkdir(path.dirname(destinationPath), { recursive: true });

  try {
    await rename(sourcePath, destinationPath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EXDEV") {
      await copyFile(sourcePath, destinationPath);
      await rm(sourcePath, { force: true });
      return;
    }

    throw error;
  }
}

export async function removeFile(filePath: string): Promise<void> {
  await rm(filePath, { force: true });
}

async function readFileHeader(filePath: string, byteLength: number): Promise<Buffer> {
  const fileHandle = await openFile(filePath, "r");
  const buffer = Buffer.alloc(byteLength);

  try {
    const result = await fileHandle.read(buffer, 0, byteLength, 0);

    return buffer.subarray(0, result.bytesRead);
  } finally {
    await fileHandle.close();
  }
}

function doesFileSignatureMatchMimeType(header: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "image/avif":
      return hasIsoBmffBrand(header, ["avif", "avis", "mif1", "msf1"]);
    case "image/gif":
      return startsWithAscii(header, "GIF87a") || startsWithAscii(header, "GIF89a");
    case "image/jpeg":
      return startsWithBytes(header, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWithBytes(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return startsWithAscii(header, "RIFF") && header.subarray(8, 12).toString("ascii") === "WEBP";
    case "video/mp4":
      return hasIsoBmffBrand(header, ["avc1", "dash", "isom", "iso2", "mp41", "mp42"]);
    case "video/ogg":
      return startsWithAscii(header, "OggS");
    case "video/quicktime":
      return hasIsoBmffBrand(header, ["qt  "]);
    case "video/webm":
      return startsWithBytes(header, [0x1a, 0x45, 0xdf, 0xa3]);
    default:
      return false;
  }
}

function startsWithAscii(buffer: Buffer, expected: string): boolean {
  return buffer.subarray(0, expected.length).toString("ascii") === expected;
}

function startsWithBytes(buffer: Buffer, expected: number[]): boolean {
  if (buffer.length < expected.length) {
    return false;
  }

  return expected.every((byte, index) => buffer[index] === byte);
}

function hasIsoBmffBrand(buffer: Buffer, expectedBrands: string[]): boolean {
  if (buffer.length < 12 || buffer.subarray(4, 8).toString("ascii") !== "ftyp") {
    return false;
  }

  for (let index = 8; index + 4 <= buffer.length; index += 4) {
    const brand = buffer.subarray(index, index + 4).toString("ascii");

    if (expectedBrands.includes(brand)) {
      return true;
    }
  }

  return false;
}
