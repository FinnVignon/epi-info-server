import { RefreshCw } from "lucide-react";

interface RefreshButtonProps {
  label: string;
  onClick: () => void;
}

export function RefreshButton({ label, onClick }: RefreshButtonProps) {
  return (
    <button
      aria-label={label}
      className="icon-button panel-icon-button"
      onClick={onClick}
      title={label}
      type="button"
    >
      <RefreshCw aria-hidden="true" size={17} />
    </button>
  );
}
