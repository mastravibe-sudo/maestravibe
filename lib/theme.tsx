"use client";

import { createContext, useContext, useEffect, useSyncExternalStore } from "react";

type ColorMode = "light" | "dark";
type ColorModeContextValue = { mode: ColorMode; toggleMode: () => void };

const ColorModeContext = createContext<ColorModeContextValue | null>(null);
const STORAGE_KEY = "maestra-color-mode";
const CHANGE_EVENT = "maestra-color-mode-change";

function getSnapshot(): ColorMode {
  return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
}

function getServerSnapshot(): ColorMode {
  return "light";
}

function subscribe(notify: () => void) {
  window.addEventListener(CHANGE_EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(CHANGE_EVENT, notify);
    window.removeEventListener("storage", notify);
  };
}

export function ColorModeProvider({ children }: { children: React.ReactNode }) {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const toggleMode = () => {
    const nextMode: ColorMode = getSnapshot() === "light" ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, nextMode);
    document.documentElement.dataset.theme = nextMode;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  return (
    <ColorModeContext.Provider value={{ mode, toggleMode }}>
      {children}
    </ColorModeContext.Provider>
  );
}

export function useColorMode() {
  const context = useContext(ColorModeContext);
  if (!context) throw new Error("useColorMode must be used inside ColorModeProvider.");
  return context;
}
