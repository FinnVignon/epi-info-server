import { assignContentGlobally, getGlobalAssignmentTarget } from "../api/adminAssignmentsApi";
import { DisplayAssignmentPanel, type AssignmentTargetOption } from "./DisplayAssignmentPanel";

interface GlobalAssignmentPanelProps {
  onUnauthorized: () => void;
}

export function GlobalAssignmentPanel({ onUnauthorized }: GlobalAssignmentPanelProps) {
  return (
    <DisplayAssignmentPanel
      assignContent={assignContentGlobally}
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
