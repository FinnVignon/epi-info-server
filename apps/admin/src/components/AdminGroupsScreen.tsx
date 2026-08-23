import { useEffect, useState } from "react";

import {
  addGroupMember,
  createGroup,
  deleteGroup,
  getGroup,
  listGroupClientOptions,
  listGroups,
  removeGroupMember,
  updateGroup,
} from "../api/adminGroupsApi";
import { ApiError } from "../api/adminApi";
import { useTemporaryNotice } from "../hooks/useTemporaryNotice";
import { useTranslation } from "../i18n";
import { AdminFeedback } from "./AdminFeedback";
import { GroupAssignmentPanel } from "./GroupAssignmentPanel";
import { GroupCreatePanel } from "./GroupCreatePanel";
import { GroupDetail } from "./GroupDetail";
import { GroupTable } from "./GroupTable";
import type { ManagedClient } from "../../../shared/clientContracts";
import type {
  DisplayGroup,
  DisplayGroupDetail,
  GroupResponse,
} from "../../../shared/groupContracts";

interface AdminGroupsScreenProps {
  onUnauthorized: () => void;
}

export function AdminGroupsScreen({ onUnauthorized }: AdminGroupsScreenProps) {
  const { t } = useTranslation();
  const [canCreateGroups, setCanCreateGroups] = useState(false);
  const [canManageGroups, setCanManageGroups] = useState<boolean | null>(null);
  const [clientOptions, setClientOptions] = useState<ManagedClient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<DisplayGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useTemporaryNotice();
  const [selectedGroup, setSelectedGroup] = useState<DisplayGroupDetail | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  useEffect(() => {
    void loadGroups();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSelectedGroup(): Promise<void> {
      if (!selectedGroupId) {
        setSelectedGroup(null);
        setClientOptions([]);
        return;
      }

      setIsLoadingDetail(true);
      setSelectedGroup(null);
      setClientOptions([]);

      try {
        const [groupResponse, clientResponse] = await Promise.all([
          getGroup(selectedGroupId),
          listGroupClientOptions(selectedGroupId),
        ]);

        if (!cancelled) {
          setSelectedGroup(groupResponse.group);
          setClientOptions(clientResponse.clients);
        }
      } catch (loadError) {
        if (!cancelled) {
          handleApiError(loadError, t.groups.errorLoadDetail);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      }
    }

    void loadSelectedGroup();

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId]);

  async function loadGroups(): Promise<void> {
    setError(null);
    setIsLoading(true);

    try {
      const response = await listGroups();

      setCanCreateGroups(response.capabilities.canCreateGroups);
      setCanManageGroups(true);
      setGroups(response.groups);
      setSelectedGroupId((currentId) =>
        currentId && response.groups.some((group) => group.id === currentId)
          ? currentId
          : (response.groups[0]?.id ?? null),
      );
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 403) {
        setCanCreateGroups(false);
        setCanManageGroups(false);
        setGroups([]);
        setSelectedGroup(null);
        setSelectedGroupId(null);
      } else {
        handleApiError(loadError, t.groups.errorLoad);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreate(name: string): Promise<boolean> {
    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await createGroup({ name });

      setGroups((currentGroups) => [...currentGroups, toGroupSummary(response.group)]);
      setSelectedGroupId(response.group.id);
      setNotice(t.groups.noticeCreated);
      return true;
    } catch (createError) {
      handleApiError(createError, t.groups.errorCreate);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(name: string): Promise<boolean> {
    if (!selectedGroupId) {
      return false;
    }

    return runGroupUpdate(
      () => updateGroup(selectedGroupId, { name }),
      t.groups.noticeUpdated,
      t.groups.errorUpdate,
    );
  }

  async function handleDelete(): Promise<void> {
    if (!selectedGroupId) {
      return;
    }

    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      await deleteGroup(selectedGroupId);
      const remainingGroups = groups.filter((group) => group.id !== selectedGroupId);

      setGroups(remainingGroups);
      setSelectedGroup(null);
      setSelectedGroupId(remainingGroups[0]?.id ?? null);
      setNotice(t.groups.noticeDeleted);
    } catch (deleteError) {
      handleApiError(deleteError, t.groups.errorDelete);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddMember(clientId: string): Promise<void> {
    if (!selectedGroupId) {
      return;
    }

    const didUpdate = await runGroupUpdate(
      () => addGroupMember(selectedGroupId, clientId),
      t.groups.noticeMemberAdded,
      t.groups.errorAddMember,
    );

    if (didUpdate) {
      await refreshClientOptions(selectedGroupId);
    }
  }

  async function handleRemoveMember(clientId: string): Promise<void> {
    if (!selectedGroupId) {
      return;
    }

    const didUpdate = await runGroupUpdate(
      () => removeGroupMember(selectedGroupId, clientId),
      t.groups.noticeMemberRemoved,
      t.groups.errorRemoveMember,
    );

    if (didUpdate) {
      await refreshClientOptions(selectedGroupId);
    }
  }

  async function runGroupUpdate(
    action: () => Promise<GroupResponse>,
    successMessage: string,
    fallbackError: string,
  ): Promise<boolean> {
    setError(null);
    setNotice(null);
    setIsSaving(true);

    try {
      const response = await action();

      setSelectedGroup(response.group);
      replaceGroupSummary(response.group);
      setNotice(successMessage);
      return true;
    } catch (updateError) {
      handleApiError(updateError, fallbackError);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function replaceGroupSummary(group: DisplayGroupDetail): void {
    setGroups((currentGroups) =>
      currentGroups.map((currentGroup) =>
        currentGroup.id === group.id ? toGroupSummary(group) : currentGroup,
      ),
    );
  }

  async function refreshClientOptions(groupId: string): Promise<void> {
    try {
      const response = await listGroupClientOptions(groupId);

      setClientOptions(response.clients);
    } catch (loadError) {
      handleApiError(loadError, t.groups.errorRefreshClients);
    }
  }

  function handleApiError(apiError: unknown, fallback: string): void {
    if (apiError instanceof ApiError && apiError.status === 401) {
      onUnauthorized();
      return;
    }

    setError(apiError instanceof Error ? apiError.message : fallback);
  }

  return (
    <section
      className={`content groups-layout ${canManageGroups === false ? "assignment-only" : ""}`}
    >
      <AdminFeedback className="screen-alerts" error={error} notice={notice} />

      {canManageGroups !== false ? (
        <GroupTable
          groups={groups}
          isLoading={isLoading}
          onRefresh={() => void loadGroups()}
          onSelectGroup={setSelectedGroupId}
          selectedGroupId={selectedGroupId}
        />
      ) : null}

      <div className="groups-side-column">
        {canManageGroups !== false ? (
          <>
            <GroupDetail
              clientOptions={clientOptions}
              group={selectedGroup}
              isLoading={isLoadingDetail}
              isSaving={isSaving}
              onAddMember={handleAddMember}
              onDelete={handleDelete}
              onRemoveMember={handleRemoveMember}
              onUpdate={handleUpdate}
            />

            {canCreateGroups ? (
              <GroupCreatePanel isSaving={isSaving} onCreate={handleCreate} />
            ) : null}
          </>
        ) : null}

        <GroupAssignmentPanel onUnauthorized={onUnauthorized} preferredGroupId={selectedGroupId} />
      </div>
    </section>
  );
}

function toGroupSummary(group: DisplayGroupDetail): DisplayGroup {
  const { members: _members, ...summary } = group;

  return summary;
}
