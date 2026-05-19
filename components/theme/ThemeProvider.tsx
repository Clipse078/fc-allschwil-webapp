"use client";

import { useEffect, type ReactNode } from "react";

const THEME_STORAGE_KEY = "sportclubevo-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

type ThemeProviderProps = {
  children: ReactNode;
};

function resolveInitialTheme() {
  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

  if (storedTheme === "light" || storedTheme === "dark") {
    return storedTheme;
  }

  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    applyTheme(resolveInitialTheme());

    const mediaQuery = window.matchMedia(DARK_QUERY);

    function handleSystemThemeChange(event: MediaQueryListEvent) {
      const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);

      if (storedTheme === "light" || storedTheme === "dark") {
        return;
      }

      applyTheme(event.matches ? "dark" : "light");
    }

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  return children;
}
