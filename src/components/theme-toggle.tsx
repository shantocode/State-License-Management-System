"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let savedDark = false;
    try {
      savedDark = localStorage.getItem("slms-theme") === "dark";
    } catch {
      // Theme switching remains available when browser storage is disabled.
    }
    document.documentElement.classList.toggle("dark", savedDark);
    setDark(savedDark);
  }, []);

  function toggleTheme() {
    const nextDark = !dark;
    document.documentElement.classList.toggle("dark", nextDark);
    setDark(nextDark);
    try {
      localStorage.setItem("slms-theme", nextDark ? "dark" : "light");
    } catch {
      // The selected theme still applies for this visit.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={dark ? "Switch to white mode" : "Switch to dark mode"}
      aria-pressed={dark}
      title={dark ? "Switch to white mode" : "Switch to dark mode"}
    >
      {dark ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span>{dark ? "White mode" : "Dark mode"}</span>
    </button>
  );
}
