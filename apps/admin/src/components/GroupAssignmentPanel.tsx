import { assignAssetToGroup, listAssignmentGroups } from "../api/adminAssignmentsApi";
import { AssetAssignmentPanel, type AssignmentTargetOption } from "./AssetAssignmentPanel";

interface GroupAssignmentPanelProps {
  onUnauthorized: () => void;
  preferredGroupId: string | null;
}

export function GroupAssignmentPanel({
  onUnauthorized,
  preferredGroupId,
}: GroupAssignmentPanelProps) {
  return (
    <AssetAssignmentPanel
      assignAsset={assignAssetToGroup}
      loadTargets={loadGroupTargets}
      onUnauthorized={onUnauthorized}
      panelClassName="group-assignment-panel"
      preferredTargetId={preferredGroupId}
      targetLabel="Group"
      title="Group Display Assignment"
    />
  );
}

async function loadGroupTargets(): Promise<AssignmentTargetOption[]> {
  const response = await listAssignmentGroups();

  return response.groups.map((group) => ({
    id: group.id,
    name: group.name,
  }));
}
