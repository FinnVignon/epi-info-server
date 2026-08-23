import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

interface SortableTableHeaderProps<SortKey extends string> {
  activeSortKey: SortKey;
  direction: SortDirection;
  label: string;
  onSort: (sortKey: SortKey) => void;
  sortKey: SortKey;
}

export function SortableTableHeader<SortKey extends string>({
  activeSortKey,
  direction,
  label,
  onSort,
  sortKey,
}: SortableTableHeaderProps<SortKey>) {
  const isActive = activeSortKey === sortKey;
  const SortIcon = isActive ? (direction === "asc" ? ArrowUp : ArrowDown) : ChevronsUpDown;

  return (
    <th aria-sort={isActive ? (direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        className={`sort-button ${isActive ? "active" : ""}`}
        onClick={() => onSort(sortKey)}
        type="button"
      >
        <span>{label}</span>
        <SortIcon aria-hidden="true" size={13} />
      </button>
    </th>
  );
}
