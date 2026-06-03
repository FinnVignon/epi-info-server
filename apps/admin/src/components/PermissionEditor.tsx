import { useState } from "react";

import type {
  AdminPermissionAction,
  AdminPermissionGrant,
  AdminPermissionTargetType,
} from "../../../shared/adminContracts";

const ACTION_OPTIONS: Array<{ label: string; value: AdminPermissionAction }> = [
  { label: "Users", value: "manage_users" },
  { label: "Clients", value: "manage_clients" },
  { label: "Groups", value: "manage_groups" },
  { label: "Content", value: "manage_content" },
  { label: "Assignments", value: "manage_assignments" },
];

const TARGET_OPTIONS: Array<{ label: string; value: AdminPermissionTargetType }> = [
  { label: "Global", value: "global" },
  { label: "Group", value: "group" },
  { label: "Client", value: "client" },
];

interface PermissionEditorProps {
  disabled?: boolean;
  onChange: (permissions: AdminPermissionGrant[]) => void;
  permissions: AdminPermissionGrant[];
}

export function PermissionEditor({ disabled, onChange, permissions }: PermissionEditorProps) {
  const [draftActions, setDraftActions] = useState<AdminPermissionAction[]>(["manage_content"]);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftTargetId, setDraftTargetId] = useState("");
  const [draftTargetType, setDraftTargetType] = useState<AdminPermissionTargetType>("global");

  function addPermission(): void {
    setDraftError(null);

    if (draftActions.length === 0) {
      setDraftError("Select at least one action.");
      return;
    }

    if (draftTargetType !== "global" && draftTargetId.trim().length === 0) {
      setDraftError("Target id is required.");
      return;
    }

    const permission: AdminPermissionGrant =
      draftTargetType === "global"
        ? {
            actions: draftActions,
            targetId: null,
            targetType: "global",
          }
        : {
            actions: draftActions,
            targetId: draftTargetId.trim(),
            targetType: draftTargetType,
          };
    const targetKey = getPermissionTargetKey(permission);

    if (permissions.some((existing) => getPermissionTargetKey(existing) === targetKey)) {
      setDraftError("That target already has a permission grant.");
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
      actions.includes(action)
        ? actions.filter((existingAction) => existingAction !== action)
        : [...actions, action],
    );
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
                  <span>{formatPermissionTarget(permission)}</span>
                  <small>{formatPermissionActions(permission.actions)}</small>
                </div>
                <button
                  className="ghost-button"
                  disabled={disabled}
                  onClick={() => removePermission(targetKey)}
                  type="button"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="metric">No scoped permissions.</p>
      )}

      <div className="permission-builder">
        <label>
          <span>Scope</span>
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
            <span>{draftTargetType === "group" ? "Group id" : "Client id"}</span>
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
          Add permission
        </button>
      </div>
    </div>
  );
}

export function formatPermissionActions(actions: AdminPermissionAction[]): string {
  return actions.map(formatPermissionAction).join(", ");
}

export function formatPermissionTarget(permission: AdminPermissionGrant): string {
  if (permission.targetType === "global") {
    return "Global";
  }

  return `${permission.targetType}: ${permission.targetId}`;
}

export function getPermissionTargetKey(permission: AdminPermissionGrant): string {
  return `${permission.targetType}:${permission.targetId ?? "global"}`;
}

function formatPermissionAction(action: AdminPermissionAction): string {
  return ACTION_OPTIONS.find((option) => option.value === action)?.label ?? action;
}
