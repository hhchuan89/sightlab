"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle() {
  const t = useTranslations("toggle");
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Sync state to whatever the no-flash script already applied.
  useEffect(() => {
    setTheme(currentTheme());
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    const el = document.documentElement;
    el.classList.toggle("dark", next === "dark");
    el.style.colorScheme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode / blocked storage — toggle still works for the session */
    }
    setTheme(next);
  }

  // Render a stable placeholder until mounted to avoid a hydration mismatch
  // (server can't know the client's stored theme).
  const isDark = mounted && theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t("theme")}
      title={t("theme")}
      className="flex size-9 items-center justify-center rounded-full border border-border text-text-2 transition-colors hover:border-primary hover:text-accent"
    >
      <span className="text-base leading-none" aria-hidden suppressHydrationWarning>
        {isDark ? "☀" : "☾"}
      </span>
    </button>
  );
}
