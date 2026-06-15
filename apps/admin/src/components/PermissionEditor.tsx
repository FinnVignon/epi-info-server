import { useState } from "react";

import type {
  AdminPermissionAction,
  AdminPermissionGrant,
  AdminPermissionTargetType,
} from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

interface PermissionEditorProps {
  disabled?: boolean;
  onChange: (permissions: AdminPermissionGrant[]) => void;
  permissions: AdminPermissionGrant[];
}

export function PermissionEditor({ disabled, onChange, permissions }: PermissionEditorProps) {
  const { t } = useTranslation();
  const [draftActions, setDraftActions] = useState<AdminPermissionAction[]>(["manage_content"]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftTargetId, setDraftTargetId] = useState("");
  const [draftTargetType, setDraftTargetType] = useState<AdminPermissionTargetType>("global");

  const ACTION_OPTIONS: Array<{ label: string; value: AdminPermissionAction }> = [
    { label: t.permissions.actionUsers, value: "manage_users" },
    { label: t.permissions.actionClients, value: "manage_clients" },
    { label: t.permissions.actionGroups, value: "manage_groups" },
    { label: t.permissions.actionContent, value: "manage_content" },
    { label: t.permissions.actionAssignments, value: "manage_assignments" },
  ];

  const TARGET_OPTIONS: Array<{ label: string; value: AdminPermissionTargetType }> = [
    { label: t.permissions.scopeGlobal, value: "global" },
    { label: t.permissions.scopeGroup, value: "group" },
    { label: t.permissions.scopeClient, value: "client" },
  ];

  function addPermission(): void {
    setDraftError(null);

    if (draftActions.length === 0) {
      setDraftError(t.permissions.errorNoAction);
      return;
    }

    if (draftTargetType !== "global" && draftTargetId.trim().length === 0) {
      setDraftError(t.permissions.errorNoTarget);
      return;
    }

    const permission: AdminPermissionGrant =
      draftTargetType === "global"
        ? { actions: draftActions, targetId: null, targetType: "global" }
        : { actions: draftActions, targetId: draftTargetId.trim(), targetType: draftTargetType };

    const targetKey = getPermissionTargetKey(permission);

    if (permissions.some((existing) => getPermissionTargetKey(existing) === targetKey)) {
      setDraftError(t.permissions.errorDuplicate);
      return;
    }

    onChange([...permissions, permission]);
    setDraftTargetId("");
  }

  function removePermission(targetKey: string): void {
    onChange(permissions.filter((permission) => getPermissionTargetKey(permission) !== targetKey));
  }

  function toggleAction(action: AdminPermissionAction): void {
    setDraftActions((actions) =>
      actions.includes(action) ? actions.filter((a) => a !== action) : [...actions, action],
    );
  }

  function formatAction(action: AdminPermissionAction): string {
    return ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action;
  }

  return (
    <div className="permission-editor">
      {permissions.length ? (
        <ul className="permission-list">
          {permissions.map((permission) => {
            const targetKey = getPermissionTargetKey(permission);
            return (
              <li key={targetKey}>
                <div>
                  <span>{formatPermissionTarget(permission, t)}</span>
                  <small>{permission.actions.map(formatAction).join(", ")}</small>
                </div>
                <button
                  className="ghost-button"
                  disabled={disabled}
                  onClick={() => removePermission(targetKey)}
                  type="button"
                >
                  {t.permissions.remove}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="metric">{t.permissions.noPermissions}</p>
      )}

      <div className="permission-builder">
        <label>
          <span>{t.permissions.scope}</span>
          <select
            disabled={disabled}
            onChange={(event) => {
              setDraftTargetType(event.target.value as AdminPermissionTargetType);
              setDraftTargetId("");
            }}
            value={draftTargetType}
          >
            {TARGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {draftTargetType !== "global" ? (
          <label>
            <span>
              {draftTargetType === "group" ? t.permissions.groupId : t.permissions.clientId}
            </span>
            <input
              disabled={disabled}
              onChange={(event) => setDraftTargetId(event.target.value)}
              value={draftTargetId}
            />
          </label>
        ) : null}

        <div className="checkbox-grid">
          {ACTION_OPTIONS.map((option) => (
            <label key={option.value}>
              <input
                checked={draftActions.includes(option.value)}
                disabled={disabled}
                onChange={() => toggleAction(option.value)}
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>

        {draftError ? <p className="form-error">{draftError}</p> : null}

        <button
          className="secondary-button"
          disabled={disabled}
          onClick={addPermission}
          type="button"
        >
          {t.permissions.addButton}
        </button>
      </div>
    </div>
  );
}

// Ces fonctions sont exportées car utilisées dans AdminUserDetail
export function formatPermissionTarget(
  permission: AdminPermissionGrant,
  t: { permissions: { targetGlobal: string; targetGroup: string; targetClient: string } },
): string {
  if (permission.targetType === "global") return t.permissions.targetGlobal;
  const label =
    permission.targetType === "group" ? t.permissions.targetGroup : t.permissions.targetClient;
  return `${label} : ${permission.targetId}`;
}

export function getPermissionTargetKey(permission: AdminPermissionGrant): string {
  return `${permission.targetType}:${permission.targetId ?? "global"}`;
}
