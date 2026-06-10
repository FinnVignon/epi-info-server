import { useState } from "react";

interface GroupCreatePanelProps {
  isSaving: boolean;
  onCreate: (name: string) => Promise<boolean>;
}

export function GroupCreatePanel({ isSaving, onCreate }: GroupCreatePanelProps) {
  const [name, setName] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (await onCreate(name)) {
      setName("");
    }
  }

  return (
    <article className="panel group-create-panel">
      <h2>Create Group</h2>
      <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
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
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? "Creating" : "Create group"}
        </button>
      </form>
    </article>
  );
}
