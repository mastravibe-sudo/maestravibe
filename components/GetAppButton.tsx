"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function subscribeInstalled(notify: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", notify);
  window.addEventListener("appinstalled", notify);
  return () => {
    displayMode.removeEventListener("change", notify);
    window.removeEventListener("appinstalled", notify);
  };
}

function isInstalledSnapshot() {
  return window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean(navigator.standalone));
}

function isIosSnapshot() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function getServerFalse() {
  return false;
}

function subscribeNothing() {
  return () => undefined;
}

export default function GetAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const isInstalled = useSyncExternalStore(subscribeInstalled, isInstalledSnapshot, getServerFalse);
  const isIos = useSyncExternalStore(subscribeNothing, isIosSnapshot, getServerFalse);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleInstallAvailable = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const handleInstalled = () => setInstallPrompt(null);

    window.addEventListener("beforeinstallprompt", handleInstallAvailable);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (isInstalled) return;
    if (!installPrompt) {
      setShowHelp(true);
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === "accepted") setShowHelp(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        disabled={isInstalled}
        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-default disabled:bg-emerald-600"
      >
        <span aria-hidden="true">{isInstalled ? "✓" : "↓"}</span>
        {isInstalled ? "App installed" : "Get app"}
      </button>

      {showHelp ? (
        <div className="fixed inset-0 z-100 flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowHelp(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="get-app-title" className="w-full max-w-sm rounded-2xl border border-white/10 bg-zinc-950 p-5 text-zinc-100 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Maestra Vibe</p>
                <h2 id="get-app-title" className="mt-2 text-xl font-semibold">Add the app to your device</h2>
              </div>
              <button type="button" onClick={() => setShowHelp(false)} aria-label="Close" className="rounded-md px-2 py-1 text-zinc-400 hover:bg-white/10 hover:text-white">✕</button>
            </div>

            {isIos ? (
              <ol className="mt-5 space-y-3 text-sm leading-relaxed text-zinc-300">
                <li className="flex gap-3"><span className="font-semibold text-blue-300">1.</span><span>Open this page in Safari.</span></li>
                <li className="flex gap-3"><span className="font-semibold text-blue-300">2.</span><span>Tap the Share button in Safari.</span></li>
                <li className="flex gap-3"><span className="font-semibold text-blue-300">3.</span><span>Choose <strong className="text-white">Add to Home Screen</strong>, then tap Add.</span></li>
              </ol>
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-zinc-300">
                Open your browser menu and choose <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong>. The option appears when your browser supports installation.
              </p>
            )}
            <button type="button" onClick={() => setShowHelp(false)} className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">Got it</button>
          </section>
        </div>
      ) : null}
    </>
  );
}
