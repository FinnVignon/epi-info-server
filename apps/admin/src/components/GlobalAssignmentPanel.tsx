import { assignAssetGlobally, getGlobalAssignmentTarget } from "../api/adminAssignmentsApi";
import { AssetAssignmentPanel, type AssignmentTargetOption } from "./AssetAssignmentPanel";

interface GlobalAssignmentPanelProps {
  onUnauthorized: () => void;
}

export function GlobalAssignmentPanel({ onUnauthorized }: GlobalAssignmentPanelProps) {
  return (
    <AssetAssignmentPanel
      assignAsset={assignAssetGlobally}
      hideTargetSelector
      loadTargets={loadGlobalTarget}
      onUnauthorized={onUnauthorized}
      panelClassName="global-assignment-panel"
      preferredTargetId="global"
      targetLabel="Target"
      title="All Displays"
      unavailableMessage="Global assignment permission is required to manage all displays."
    />
  );
}

async function loadGlobalTarget(): Promise<AssignmentTargetOption[]> {
  const response = await getGlobalAssignmentTarget();

  return [response.target];
}
