import { useEffect, useMemo, useState } from "react";

import { formatDate } from "../utils/formatDate";
import type { ManagedClient } from "../../../shared/clientContracts";
import type { DisplayGroupDetail } from "../../../shared/groupContracts";

interface GroupDetailProps {
  clientOptions: ManagedClient[];
  group: DisplayGroupDetail | null;
  isLoading: boolean;
  isSaving: boolean;
  onAddMember: (clientId: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onRemoveMember: (clientId: string) => Promise<void>;
  onUpdate: (name: string) => Promise<boolean>;
}

export function GroupDetail({
  clientOptions,
  group,
  isLoading,
  isSaving,
  onAddMember,
  onDelete,
  onRemoveMember,
  onUpdate,
}: GroupDetailProps) {
  const [clientId, setClientId] = useState("");
  const [name, setName] = useState("");
  const manageableClientIds = useMemo(
    () => new Set(clientOptions.map((client) => client.id)),
    [clientOptions],
  );
  const availableClients = useMemo(() => {
    const memberIds = new Set(group?.members.map((member) => member.id) ?? []);

    return clientOptions.filter((client) => !memberIds.has(client.id));
  }, [clientOptions, group?.members]);

  useEffect(() => {
    setName(group?.name ?? "");
  }, [group?.id, group?.name]);

  useEffect(() => {
    setClientId((currentClientId) =>
      availableClients.some((client) => client.id === currentClientId)
        ? currentClientId
        : (availableClients[0]?.id ?? ""),
    );
  }, [availableClients]);

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await onUpdate(name);
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (clientId) {
      await onAddMember(clientId);
    }
  }

  async function handleDelete(groupName: string): Promise<void> {
    if (window.confirm(`Delete the group "${groupName}"?`)) {
      await onDelete();
    }
  }

  if (isLoading) {
    return (
      <article className="panel groups-detail-panel">
        <p className="metric">Loading group...</p>
      </article>
    );
  }

  if (!group) {
    return (
      <article className="panel groups-detail-panel">
        <p className="metric">Select a group.</p>
      </article>
    );
  }

  return (
    <article className="panel groups-detail-panel">
      <div className="panel-header">
        <div>
          <h2>{group.name}</h2>
          <p className="metric">{group.id}</p>
        </div>
        <button
          className="danger-button"
          disabled={isSaving}
          onClick={() => void handleDelete(group.name)}
          type="button"
        >
          Delete
        </button>
      </div>

      <div className="detail-grid">
        <p>
          <span>Members</span>
          <strong>{group.memberCount}</strong>
        </p>
        <p>
          <span>Created</span>
          <strong>{formatDate(group.createdAt)}</strong>
        </p>
        <p>
          <span>Updated</span>
          <strong>{formatDate(group.updatedAt)}</strong>
        </p>
      </div>

      <form className="form-grid compact-form" onSubmit={(event) => void handleUpdate(event)}>
        <label>
          <span>Group name</span>
          <input
            maxLength={255}
            minLength={2}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <button className="secondary-button" disabled={isSaving} type="submit">
          Save name
        </button>
      </form>

      <section className="section-block">
        <h3>Members</h3>
        {group.members.length ? (
          <ul className="group-member-list">
            {group.members.map((member) => (
              <li key={member.id}>
                <div>
                  <strong>{member.name}</strong>
                  <span>
                    {member.connectionStatus} / {member.accessStatus}
                  </span>
                </div>
                <button
                  className="ghost-button"
                  disabled={isSaving || !manageableClientIds.has(member.id)}
                  onClick={() => void onRemoveMember(member.id)}
                  title={
                    manageableClientIds.has(member.id)
                      ? "Remove client from group"
                      : "Client management permission is required"
                  }
                  type="button"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="metric">This group has no clients.</p>
        )}

        <form className="form-grid compact-form" onSubmit={(event) => void handleAddMember(event)}>
          <label>
            <span>Add client</span>
            <select
              disabled={isSaving || availableClients.length === 0}
              onChange={(event) => setClientId(event.target.value)}
              value={clientId}
            >
              {availableClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <button className="secondary-button" disabled={isSaving || !clientId} type="submit">
            Add
          </button>
        </form>
        {!availableClients.length ? (
          <p className="metric">No additional permitted clients are available.</p>
        ) : null}
      </section>
    </article>
  );
}
