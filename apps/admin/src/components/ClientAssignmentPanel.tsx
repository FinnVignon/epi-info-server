import { assignContentToClient, listAssignmentClients } from "../api/adminAssignmentsApi";
import { useTranslation } from "../i18n";
import { DisplayAssignmentPanel } from "./DisplayAssignmentPanel";
import type { AssignmentTargetOption } from "./displayAssignmentTypes";

interface ClientAssignmentPanelProps {
  onUnauthorized: () => void;
  preferredClientId: string | null;
}

export function ClientAssignmentPanel({
  onUnauthorized,
  preferredClientId,
}: ClientAssignmentPanelProps) {
  const { t } = useTranslation();

  return (
    <DisplayAssignmentPanel
      assignContent={assignContentToClient}
      hideTargetSelector={preferredClientId !== null}
      loadTargets={loadClientTargets}
      onUnauthorized={onUnauthorized}
      panelClassName="client-assignment-panel"
      preferredTargetId={preferredClientId}
      targetLabel={t.assignment.clientTarget}
      title={t.assignment.title}
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
