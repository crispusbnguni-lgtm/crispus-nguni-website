
"use client";

import { useEffect } from "react";

type Theme = "light" | "dark" | "sepia";

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  // Clear previous theme classes.
  root.classList.remove("light", "dark", "sepia");

  // Apply the selected theme consistently.
  root.classList.add(theme);
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme === "sepia" ? "light" : theme;

  // Remember the selection after refresh.
  localStorage.setItem("theme", theme);
}

export function ThemeInitializer() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    const theme: Theme =
      savedTheme === "light" ||
      savedTheme === "dark" ||
      savedTheme === "sepia"
        ? savedTheme
        : "dark";

    applyTheme(theme);
  }, []);

  return null;
}

export { applyTheme };
export type { Theme };