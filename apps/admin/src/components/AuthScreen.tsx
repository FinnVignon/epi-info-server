import { useState } from "react";

import { bootstrapAdmin, loginAdmin } from "../api/adminApi";
import type { AdminAuthResponse } from "../../../shared/adminContracts";
import { useTranslation } from "../i18n";

interface AuthScreenProps {
  error: string | null;
  mode: "bootstrap" | "login";
  onAuthenticated: (response: AdminAuthResponse) => void;
  onError: (error: string | null) => void;
}

export function AuthScreen({ error, mode, onAuthenticated, onError }: AuthScreenProps) {
  const { t } = useTranslation();
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
      const response = isBootstrap
        ? await bootstrapAdmin({ displayName, email, password })
        : await loginAdmin({ email, password });

      onAuthenticated(response);
    } catch (submitError) {
      onError(submitError instanceof Error ? submitError.message : t.auth.errorFallback);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <h1>{t.brand}</h1>
          <span>{isBootstrap ? t.auth.bootstrapTitle : t.auth.loginTitle}</span>
        </div>

        <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
          {isBootstrap ? (
            <label>
              <span>{t.auth.displayName}</span>
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
            <span>{t.auth.email}</span>
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
            <span>{t.auth.password}</span>
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
            {isSubmitting
              ? t.auth.submitting
              : isBootstrap
                ? t.auth.bootstrapButton
                : t.auth.loginButton}
          </button>
        </form>
      </section>
    </main>
  );
}
