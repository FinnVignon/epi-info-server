export function toIsoString(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

export function isDuplicateEntryError(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === "ER_DUP_ENTRY"
  );
}
