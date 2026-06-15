export function formatDate(value: string | null, emptyLabel = "Never"): string {
  return value ? new Date(value).toLocaleString() : emptyLabel;
}
