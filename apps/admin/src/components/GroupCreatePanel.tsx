import { useState } from "react";

import { useTranslation } from "../i18n";

interface GroupCreatePanelProps {
  isSaving: boolean;
  onCreate: (name: string) => Promise<boolean>;
}

export function GroupCreatePanel({ isSaving, onCreate }: GroupCreatePanelProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (await onCreate(name)) {
      setName("");
    }
  }

  return (
    <article className="panel group-create-panel">
      <h2>{t.groups.createTitle}</h2>
      <form className="form-grid" onSubmit={(event) => void handleSubmit(event)}>
        <label>
          <span>{t.groups.groupName}</span>
          <input
            maxLength={255}
            minLength={2}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <button className="primary-button" disabled={isSaving} type="submit">
          {isSaving ? t.groups.creating : t.groups.createButton}
        </button>
      </form>
    </article>
  );
}
