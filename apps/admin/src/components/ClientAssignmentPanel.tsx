import {
  assignAssetToClient,
  listAssignmentClients,
  removeClientAssignment,
} from "../api/adminAssignmentsApi";
import { AssetAssignmentPanel, type AssignmentTargetOption } from "./AssetAssignmentPanel";

interface ClientAssignmentPanelProps {
  onUnauthorized: () => void;
  preferredClientId: string | null;
}

export function ClientAssignmentPanel({
  onUnauthorized,
  preferredClientId,
}: ClientAssignmentPanelProps) {
  return (
    <AssetAssignmentPanel
      assignAsset={assignAssetToClient}
      clearActionLabel="Inherit from group"
      clearAssignment={removeClientAssignment}
      clearSuccessMessage={(client) =>
        `${client.name} will now use its group assignment, or global content if no group assignment applies.`
      }
      loadTargets={loadClientTargets}
      onUnauthorized={onUnauthorized}
      panelClassName="client-assignment-panel"
      preferredTargetId={preferredClientId}
      targetLabel="Client"
      title="Display Assignment"
    />
  );
}

async function loadClientTargets(): Promise<AssignmentTargetOption[]> {
  const response = await listAssignmentClients();

  return response.clients.map((client) => ({
    id: client.id,
    name: client.name,
  }));
}
