import { useEffect, useState } from "react";

import { SUPPORTED_MANIFEST_ITEM_TYPES } from "../../shared/contracts";
import "./App.css";

interface AdminUser {
  displayName: string;
  email: string;
  id: string;
  isSuperAdmin: boolean;
}

interface AuthResponse {
  session: {
    expiresAt: string;
  };
  user: AdminUser;
}

interface BootstrapStatusResponse {
  needsBootstrap: boolean;
}

interface HealthResponse {
  database: {
    missingTables: string[];
    status: string;
  };
  service: string;
  supportedManifestItemTypes: string[];
}

interface DashboardResponse {
  clients: Array<{
    currentManifestId: string | null;
    id: string;
    lastSeenAt: string | null;
    name: string;
    status: "online" | "offline" | "unknown";
  }>;
  groups: Array<{
    clientCount: number;
    id: string;
    name: string;
  }>;
}

type AuthMode = "checking" | "bootstrap" | "login" | "authenticated";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as unknown;

  if (!response.ok) {
    const error =
      typeof body === "object" && body !== null && "error" in body && typeof body.error === "string"
        ? body.error
        : "Request failed";

    throw new Error(error);
  }

  return body as T;
}

export function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [apiStatus, setApiStatus] = useState<"checking" | "ok" | "error">("checking");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("checking");
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/admin/me");

        if (!cancelled) {
          if (response.ok) {
            const body = (await response.json()) as AuthResponse;

            setCurrentUser(body.user);
            setAuthMode("authenticated");
            return;
          }

          if (response.status !== 401) {
            throw new Error("Unable to check admin session");
          }
        }

        const bootstrapStatus = await readJsonResponse<BootstrapStatusResponse>(
          await fetch("/api/admin/bootstrap/status"),
        );

        if (!cancelled) {
          setAuthMode(bootstrapStatus.needsBootstrap ? "bootstrap" : "login");
        }
      } catch (error) {
        if (!cancelled) {
          setAuthError(error instanceof Error ? error.message : "Unable to check admin session");
          setAuthMode("login");
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authMode !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function loadDashboard() {
      try {
        const [healthResponse, dashboardResponse] = await Promise.all([
          fetch("/api/health"),
          fetch("/api/dashboard"),
        ]);
        const healthBody = await readJsonResponse<HealthResponse>(healthResponse);
        const dashboardBody = await readJsonResponse<DashboardResponse>(dashboardResponse);

        if (!cancelled) {
          setDashboard(dashboardBody);
          setHealth(healthBody);
          setApiStatus("ok");
        }
      } catch {
        if (!cancelled) {
          setApiStatus("error");
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [authMode]);

  async function handleAuthenticated(response: Response): Promise<void> {
    const body = await readJsonResponse<AuthResponse>(response);

    setAuthError(null);
    setCurrentUser(body.user);
    setAuthMode("authenticated");
  }

  async function handleLogout(): Promise<void> {
    await fetch("/api/admin/logout", {
      method: "POST",
    });

    setCurrentUser(null);
    setDashboard(null);
    setHealth(null);
    setApiStatus("checking");

    const bootstrapStatus = await readJsonResponse<BootstrapStatusResponse>(
      await fetch("/api/admin/bootstrap/status"),
    );

    setAuthMode(bootstrapStatus.needsBootstrap ? "bootstrap" : "login");
  }

  if (authMode === "checking") {
    return (
      <main className="auth-shell">
        <section className="auth-panel">
          <div className="brand auth-brand">
            <h1>Epi Info Admin</h1>
            <span>Checking admin session</span>
          </div>
        </section>
      </main>
    );
  }

  if (authMode === "bootstrap" || authMode === "login") {
    return (
      <AuthScreen
        error={authError}
        mode={authMode}
        onAuthenticated={handleAuthenticated}
        onError={setAuthError}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>Epi Info Admin</h1>
          <span>{currentUser ? currentUser.email : "Controller server"}</span>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill ${apiStatus}`}>API {apiStatus}</span>
          <button className="secondary-button" onClick={() => void handleLogout()} type="button">
            Log out
          </button>
        </div>
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
          <h2>Clients And Groups</h2>
          <div className="summary-grid">
            <section>
              <h3>Clients</h3>
              {dashboard?.clients.length ? (
                <ul className="summary-list">
                  {dashboard.clients.map((client) => (
                    <li key={client.id}>
                      <span>{client.name}</span>
                      <small>{client.status}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="metric">No clients registered yet.</p>
              )}
            </section>

            <section>
              <h3>Groups</h3>
              {dashboard?.groups.length ? (
                <ul className="summary-list">
                  {dashboard.groups.map((group) => (
                    <li key={group.id}>
                      <span>{group.name}</span>
                      <small>{group.clientCount} clients</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="metric">No groups created yet.</p>
              )}
            </section>
          </div>
        </article>
      </section>
    </main>
  );
}

interface AuthScreenProps {
  error: string | null;
  mode: "bootstrap" | "login";
  onAuthenticated: (response: Response) => Promise<void>;
  onError: (error: string | null) => void;
}

function AuthScreen({ error, mode, onAuthenticated, onError }: AuthScreenProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const isBootstrap = mode === "bootstrap";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    onError(null);

    try {
      const response = await fetch(isBootstrap ? "/api/admin/bootstrap" : "/api/admin/login", {
        body: JSON.stringify(
          isBootstrap
            ? {
                displayName,
                email,
                password,
              }
            : {
                email,
                password,
              },
        ),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        await readJsonResponse(response);
      }

      await onAuthenticated(response);
    } catch (submitError) {
      onError(submitError instanceof Error ? submitError.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <h1>Epi Info Admin</h1>
          <span>{isBootstrap ? "Create the first administrator" : "Admin sign in"}</span>
        </div>

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          {isBootstrap ? (
            <label>
              <span>Display name</span>
              <input
                autoComplete="name"
                minLength={2}
                onChange={(event) => setDisplayName(event.target.value)}
                required
                type="text"
                value={displayName}
              />
            </label>
          ) : null}

          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            <span>Password</span>
            <input
              autoComplete={isBootstrap ? "new-password" : "current-password"}
              minLength={10}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Please wait" : isBootstrap ? "Create admin" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
