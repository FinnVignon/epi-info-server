import { useEffect, useState } from "react";

import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../shared/contracts";
import "./App.css";

interface HealthResponse {
  database: {
    missingTables: string[];
    status: string;
  };
  service: string;
  supportedManifestItemTypes: string[];
}

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [status, setStatus] = useState<"checking" | "ok" | "error">("checking");

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health");
        const body = (await response.json()) as HealthResponse;

        if (!cancelled) {
          setHealth(body);
          setStatus("ok");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
        }
      }
    }

    void loadHealth();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>Epi Info Admin</h1>
          <span>Controller server</span>
        </div>
        <span className={`status-pill ${status}`}>API {status}</span>
      </header>

      <section className="content">
        <article className="panel">
          <h2>Server</h2>
          <p className="metric">Service: {health?.service ?? "not connected"}</p>
          <p className="metric">Database: {health?.database.status ?? "unknown"}</p>
          {health?.database.missingTables.length ? (
            <p className="metric">Missing tables: {health.database.missingTables.join(", ")}</p>
          ) : null}
        </article>

        <article className="panel">
          <h2>Display Types</h2>
          <div className="content-types">
            {(health?.supportedManifestItemTypes ?? SUPPORTED_MANIFEST_ITEM_TYPES).map((type) => (
              <span className="content-type" key={type}>
                {type}
              </span>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Next Build Step</h2>
          <p className="metric">Add clients, assets, manifests, and assignments.</p>
        </article>
      </section>
    </main>
  );
}
