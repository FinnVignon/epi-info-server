import { useAdminGroups } from "../hooks/useAdminGroups";
import { useTranslation } from "../i18n";
import { AdminFeedback } from "./AdminFeedback";
import { GroupCreatePanel } from "./GroupCreatePanel";
import { GroupDetail } from "./GroupDetail";
import { GroupTable } from "./GroupTable";

interface AdminGroupsScreenProps {
  onUnauthorized: () => void;
}

export function AdminGroupsScreen({ onUnauthorized }: AdminGroupsScreenProps) {
  const { t } = useTranslation();
  const groups = useAdminGroups(onUnauthorized);

  return (
    <section className="content groups-layout">
      <AdminFeedback className="screen-alerts" error={groups.error} notice={groups.notice} />

      {groups.canManageGroups !== false ? (
        <GroupTable
          groups={groups.groups}
          isLoading={groups.isLoading}
          onRefresh={() => void groups.refreshGroups()}
          onSelectGroup={groups.setSelectedGroupId}
          selectedGroupId={groups.selectedGroupId}
        />
      ) : null}

      <div className="groups-side-column">
        {groups.canManageGroups !== false ? (
          <>
            <GroupDetail
              clientOptions={groups.clientOptions}
              group={groups.selectedGroup}
              isLoading={groups.isLoadingDetail}
              isSaving={groups.isSaving}
              onAddMember={groups.handleAddMember}
              onDelete={groups.handleDelete}
              onRemoveMember={groups.handleRemoveMember}
              onUpdate={groups.handleUpdate}
            />

            {groups.canCreateGroups ? (
              <GroupCreatePanel isSaving={groups.isSaving} onCreate={groups.handleCreate} />
            ) : null}
          </>
        ) : (
          <article className="panel">
            <p className="metric">{t.groups.managementUnavailable}</p>
          </article>
        )}
      </div>
    </section>
  );
}
