import { realpath } from "node:fs/promises";
import path from "node:path";

export function resolveAssetStoragePath(
  assetStoragePath: string,
  storedAssetPath: string,
): string | null {
  const storageRoot = path.resolve(assetStoragePath);
  const candidatePath = path.resolve(storedAssetPath);

  return isContainedPath(storageRoot, candidatePath) ? candidatePath : null;
}

export async function resolveExistingAssetStoragePath(
  assetStoragePath: string,
  storedAssetPath: string,
): Promise<string | null> {
  const candidatePath = resolveAssetStoragePath(assetStoragePath, storedAssetPath);

  if (!candidatePath) {
    return null;
  }

  try {
    const [storageRoot, existingPath] = await Promise.all([
      realpath(path.resolve(assetStoragePath)),
      realpath(candidatePath),
    ]);

    return isContainedPath(storageRoot, existingPath) ? existingPath : null;
  } catch {
    return null;
  }
}

function isContainedPath(storageRoot: string, candidatePath: string): boolean {
  const relativePath = path.relative(storageRoot, candidatePath);

  return (
    relativePath.length > 0 &&
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}
