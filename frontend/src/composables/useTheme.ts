import { ref, watchEffect } from "vue";

type Theme = "light" | "dark";
const THEME_KEY = "theme";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// State modul tunggal: satu tema untuk seluruh app, tidak perlu store terpisah.
const theme = ref<Theme>(getInitialTheme());

watchEffect(() => {
  document.documentElement.classList.toggle("dark", theme.value === "dark");
  localStorage.setItem(THEME_KEY, theme.value);
});

export function useTheme() {
  function toggle() {
    theme.value = theme.value === "dark" ? "light" : "dark";
  }
  return { theme, toggle };
}
