import { assignContentToClient, listAssignmentClients } from "../api/adminAssignmentsApi";
import { DisplayAssignmentPanel, type AssignmentTargetOption } from "./DisplayAssignmentPanel";

interface ClientAssignmentPanelProps {
  onUnauthorized: () => void;
  preferredClientId: string | null;
}

export function ClientAssignmentPanel({
  onUnauthorized,
  preferredClientId,
}: ClientAssignmentPanelProps) {
  return (
    <DisplayAssignmentPanel
      assignContent={assignContentToClient}
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
