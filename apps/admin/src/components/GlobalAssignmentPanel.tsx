import { assignContentGlobally, getGlobalAssignmentTarget } from "../api/adminAssignmentsApi";
import { useTranslation } from "../i18n";
import { DisplayAssignmentPanel } from "./DisplayAssignmentPanel";
import type { AssignmentTargetOption } from "./displayAssignmentTypes";

interface GlobalAssignmentPanelProps {
  onUnauthorized: () => void;
}

export function GlobalAssignmentPanel({ onUnauthorized }: GlobalAssignmentPanelProps) {
  const { t } = useTranslation();

  return (
    <DisplayAssignmentPanel
      assignContent={assignContentGlobally}
      hideTargetSelector
      loadTargets={loadGlobalTarget}
      onUnauthorized={onUnauthorized}
      panelClassName="global-assignment-panel"
      preferredTargetId="global"
      targetLabel={t.assignment.globalTarget}
      title={t.assignment.globalTitle}
      unavailableMessage={t.assignment.unavailableGlobal}
    />
  );
}

async function loadGlobalTarget(): Promise<AssignmentTargetOption[]> {
  const response = await getGlobalAssignmentTarget();

  return [response.target];
}
