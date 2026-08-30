import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "onyx", label: "Onyx" },
  { value: "sky", label: "Sky" },
  { value: "plum", label: "Plum" },
  { value: "blue", label: "Blue" },
  { value: "light", label: "Light" },
  { value: "lime", label: "Lime" },
] as const;

export type Theme = (typeof THEMES)[number]["value"];

const STORAGE_KEY = "library_theme";

function isTheme(value: string | null): value is Theme {
  return THEMES.some((t) => t.value === value);
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isTheme(stored) ? stored : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
