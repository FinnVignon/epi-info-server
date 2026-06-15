import { useTranslation } from "../i18n";

export function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="brand auth-brand">
          <h1>{t.brand}</h1>
          <span>{t.auth.checkingSession}</span>
        </div>
      </section>
    </main>
  );
}
