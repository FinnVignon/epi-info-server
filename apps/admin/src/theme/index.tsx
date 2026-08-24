import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemePreference = "dark" | "light" | "system";
type ResolvedTheme = "dark" | "light";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

const THEME_STORAGE_KEY = "epi-admin-theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readStoredPreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(readStoredPreference()),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme(): void {
      const nextTheme = resolveTheme(preference, mediaQuery.matches);

      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
      setResolvedTheme(nextTheme);
    }

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);

    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [preference]);

  function handleSetPreference(nextPreference: ThemePreference): void {
    localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
    setPreference(nextPreference);
  }

  return (
    <ThemeContext.Provider
      value={{ preference, resolvedTheme, setPreference: handleSetPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return context;
}

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);

  return stored === "dark" || stored === "system" ? stored : "light";
}

function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches,
): ResolvedTheme {
  return preference === "system" ? (systemPrefersDark ? "dark" : "light") : preference;
}
