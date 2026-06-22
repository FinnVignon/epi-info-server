import { assignContentToGroup, listAssignmentGroups } from "../api/adminAssignmentsApi";
import { useTranslation } from "../i18n";
import { DisplayAssignmentPanel, type AssignmentTargetOption } from "./DisplayAssignmentPanel";

interface GroupAssignmentPanelProps {
  onUnauthorized: () => void;
  preferredGroupId: string | null;
}

export function GroupAssignmentPanel({
  onUnauthorized,
  preferredGroupId,
}: GroupAssignmentPanelProps) {
  const { t } = useTranslation();

  return (
    <DisplayAssignmentPanel
      assignContent={assignContentToGroup}
      loadTargets={loadGroupTargets}
      onUnauthorized={onUnauthorized}
      panelClassName="group-assignment-panel"
      preferredTargetId={preferredGroupId}
      targetLabel={t.assignment.groupTarget}
      title={t.assignment.groupTitle}
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
