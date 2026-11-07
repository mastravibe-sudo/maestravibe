"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void> };

export default function GetAppPage() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [inApp, setInApp] = useState(false);
  const apk = process.env.NEXT_PUBLIC_APK_URL;

  useEffect(() => {
    const ua = navigator.userAgent;
    setIos(/iPhone|iPad|iPod/i.test(ua));
    setInApp(/FBAN|FBAV|Instagram|WhatsApp|Line\//i.test(ua));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches);
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as InstallEvent); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    setDeferred(null);
  };

  const shots = ["home", "inbox", "profile"];
  const features = ["Shorts feed", "Inbox and Status", "Maestra Market", "Profile themes", "Notifications"];

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-[#07061a] px-5 py-8 text-white">
      <header className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="Maestra Vibe" className="h-24 w-24 rounded-3xl" />
        <div>
          <h1 className="text-2xl font-bold">Maestra Vibe</h1>
          <p className="text-sm text-[#c9c4e8]">More than a profile. A story of who you are.</p>
        </div>
      </header>

      <div className="mt-5 flex justify-around rounded-2xl border border-white/10 bg-[#110f2e] py-3 text-center text-xs text-[#c9c4e8]">
        <div><p className="text-base font-semibold text-white">Free</p>Price</div>
        <div><p className="text-base font-semibold text-white">Social</p>Category</div>
        <div><p className="text-base font-semibold text-white">4+</p>Age</div>
      </div>

      {installed ? (
        <p className="mt-5 rounded-xl bg-white/5 p-4 text-center text-sm">App is already installed on this device.</p>
      ) : inApp ? (
        <p className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">Open this page in Chrome or Safari to install the app.</p>
      ) : ios ? (
        <ol className="mt-5 list-decimal space-y-2 rounded-xl bg-[#110f2e] p-4 pl-8 text-sm">
          <li>Open this page in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Choose Add to Home Screen.</li>
          <li>Tap Add.</li>
        </ol>
      ) : (
        <button onClick={install} disabled={!deferred} className="mt-5 h-14 w-full rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-base font-semibold disabled:opacity-50">
          {deferred ? "Install" : "Install (open in Chrome)"}
        </button>
      )}

      {apk ? <a href={apk} className="mt-3 block h-12 rounded-full border border-white/20 text-center text-sm leading-[3rem]">Download Android APK</a> : null}

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">Preview</h2>
        <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5">
          {shots.map((s) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={s} src={`/screenshots/${s}.png`} alt={s} className="h-80 shrink-0 snap-start rounded-2xl border border-white/10" />
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">About this app</h2>
        <ul className="space-y-1 text-sm text-[#c9c4e8]">
          {features.map((f) => <li key={f}>• {f}</li>)}
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-semibold">What&apos;s new</h2>
        <p className="text-sm text-[#c9c4e8]">Faster feed, Vibe flame, status views, voice messages and a new look.</p>
      </section>

      <p className="mt-6 text-xs text-[#a8a2c9]">Notifications are optional. We ask for permission only when you choose to enable them.</p>
    </main>
  );
}

