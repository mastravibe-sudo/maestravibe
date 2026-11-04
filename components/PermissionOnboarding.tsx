"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { subscribeToWebPush } from "@/lib/push/subscribe";

const DISMISSED_KEY = "mv-push-onboarding-dismissed";
const FIRST_LOGIN_KEY = "mv-first-login-on-device";
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

function isInstalledPwa() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean(navigator.standalone));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export default function PermissionOnboarding({ userId, ready }: { userId: string | null; ready: boolean }) {
  const [visibleForUser, setVisibleForUser] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [installedEvent, setInstalledEvent] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handleInstalled = () => {
      setInstalled(true);
      setInstalledEvent(true);
    };
    window.addEventListener("appinstalled", handleInstalled);
    return () => window.removeEventListener("appinstalled", handleInstalled);
  }, []);

  useEffect(() => {
    if (!ready || !userId || !("Notification" in window)) return;

    let active = true;
    const pwaInstalled = isInstalledPwa();
    if (pwaInstalled) {
      queueMicrotask(() => {
        if (active) setInstalled(true);
      });
    }
    if (Notification.permission !== "default") return;

    let firstLogin = false;
    try {
      const firstLoginKey = `${FIRST_LOGIN_KEY}:${userId}`;
      firstLogin = localStorage.getItem(firstLoginKey) === null;
      if (firstLogin) localStorage.setItem(firstLoginKey, String(Date.now()));
      const dismissedAt = Number(localStorage.getItem(`${DISMISSED_KEY}:${userId}`));
      const dismissedRecently = Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < THREE_DAYS;
      if ((pwaInstalled || firstLogin || installedEvent) && (!dismissedRecently || installedEvent)) {
        queueMicrotask(() => {
          if (!active) return;
          setDenied(false);
          setVisibleForUser(userId);
        });
      }
    } catch (storageError) {
      console.error("Could not read notification onboarding state.", storageError);
      if (pwaInstalled || firstLogin || installedEvent) {
        queueMicrotask(() => {
          if (active) setVisibleForUser(userId);
        });
      }
    }

    return () => {
      active = false;
    };
  }, [installedEvent, ready, userId]);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(false), 2800);
    return () => window.clearTimeout(timeout);
  }, [success]);

  const dismiss = () => {
    if (userId) {
      try {
        localStorage.setItem(`${DISMISSED_KEY}:${userId}`, String(Date.now()));
      } catch (storageError) {
        console.error("Could not save notification onboarding dismissal.", storageError);
      }
    }
    setVisibleForUser(null);
  };

  const allowNotifications = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await subscribeToWebPush();
      if (result.permission === "denied") {
        setDenied(true);
        return;
      }
      if (result.permission !== "granted") {
        setError("No permission was granted. Tap Allow notifications to try again.");
        return;
      }

      setVisibleForUser(null);
      setSuccess(true);
    } catch (requestError) {
      if ("Notification" in window && Notification.permission === "denied") {
        setDenied(true);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Could not enable notifications.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <div role="status" aria-live="polite" className="fixed inset-x-4 bottom-5 z-[100] mx-auto max-w-sm rounded-2xl border border-violet-300/20 bg-linear-to-r from-violet-700 to-fuchsia-600 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">
        Notifications are ready. You won’t miss a vibe.
      </div>
    );
  }

  if (!userId || visibleForUser !== userId) return null;

  const needsIosInstall = isIos() && !installed;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="permission-onboarding-title"
        className="w-full max-w-md rounded-t-[28px] border border-white/10 bg-[#100d24] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 text-center shadow-[0_-18px_70px_rgba(0,0,0,.55)] sm:rounded-[28px] sm:px-7"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-950/40">
          <Bell className="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 id="permission-onboarding-title" className="text-xl font-bold text-white">Never miss a vibe</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-zinc-300">
          Get updates for messages, vibes, comments and follows.
        </p>

        {needsIosInstall ? (
          <p className="mt-5 rounded-xl border border-violet-300/15 bg-violet-400/10 px-4 py-3 text-sm text-violet-100">
            Add to Home Screen first: tap Share in Safari, then choose “Add to Home Screen.”
          </p>
        ) : denied ? (
          <p className="mt-5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
            Notifications are blocked. Enable them in your browser or site settings, then return here.
          </p>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void allowNotifications()}
            className="mt-6 min-h-14 w-full rounded-2xl bg-linear-to-r from-violet-600 via-purple-600 to-fuchsia-500 px-5 text-base font-semibold text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Setting up..." : "Allow notifications"}
          </button>
        )}

        {error ? <p role="alert" className="mt-3 text-xs text-pink-200">{error}</p> : null}
        <button type="button" onClick={dismiss} className="mt-4 min-h-10 px-4 text-sm text-zinc-400 underline-offset-4 hover:text-white hover:underline">
          Not now
        </button>
      </section>
    </div>
  );
}
