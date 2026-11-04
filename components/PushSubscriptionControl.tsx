"use client";

import { useState } from "react";
import { subscribeToWebPush } from "@/lib/push/subscribe";

export default function PushSubscriptionControl({ enabled }: { enabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [activeHere, setActiveHere] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const manage = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("This browser does not support push notifications.");
      }

      if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
        const installed = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean(navigator.standalone));
  if (!installed) throw new Error("Install Maestra Vibe on your Home Screen first, then enable notifications here.");
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        const response = await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: existing.endpoint }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || "Could not disable notifications.");
        await existing.unsubscribe();
        setActiveHere(false);
        setMessage("Push notifications are disabled on this device.");
        return;
      }

      const result = await subscribeToWebPush();
      if (result.permission !== "granted") {
        throw new Error("Notifications are blocked. Allow them in your browser or device settings.");
      }
      setActiveHere(true);
      setMessage("This device will receive Maestra Vibe updates.");
    } catch (pushError) {
      setMessage(pushError instanceof Error ? pushError.message : "Could not update push settings.");
    } finally {
      setBusy(false);
    }
  };

  if (!enabled) return null;

  return (
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-zinc-900 p-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-white">Phone notifications</h2>
        <p className="mt-1 text-xs text-zinc-500">Opt in on this device to receive app announcements.</p>
        {message ? <p role="status" className="mt-2 text-xs text-blue-200">{message}</p> : null}
      </div>
      <button type="button" disabled={busy} onClick={() => void manage()} className="shrink-0 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-white/5 disabled:opacity-50">
        {busy ? "Working..." : activeHere ? "Disable on this device" : "Enable on this device"}
      </button>
    </section>
  );
}
