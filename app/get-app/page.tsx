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
    setInstalled(
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };

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
  const features = [
    "Shorts feed",
    "Inbox and Status",
    "Maestra Market",
    "Profile themes",
    "Notifications",
  ];

  return (
    <main className="mx-auto min-h-dvh max-w-md bg-[#07061a] px-5 py-8 text-white">
      <header className="flex items-center gap-4">
        <img
          src="/icon-192.png"
          alt="Maestra Vibe"
          className="h-24 w-24 rounded-3xl"
        />
        <div>
          <h1 className="text-2xl font-bold">Maestra Vibe</h1>
          <p className="text-sm text-[#c9c4e8]">
            More than a profile. A story of who you are.
          </p>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-[#110f2e] py-4 text-center text-xs text-[#c9c4e8]">
        <div>
          <p className="text-base font-semibold text-white">Secure</p>
          Login
        </div>
        <div>
          <p className="text-base font-semibold text-white">Social</p>
          Community
        </div>
        <div>
          <p className="text-base font-semibold text-white">Free</p>
          Access
        </div>
      </div>

      {installed ? (
        <div className="mt-5 rounded-2xl border border-violet-400/20 bg-[#110f2e] p-5 text-center">
          <p className="text-base font-semibold">Welcome to Maestra Vibe!</p>
          <p className="mt-1 text-sm text-[#c9c4e8]">
            The app is ready on your device.
          </p>
          <a
            href="/"
            className="mt-4 block h-14 rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-center text-base font-semibold leading-[3.5rem]"
          >
            Open Maestra Vibe
          </a>
        </div>
      ) : inApp ? (
        <p className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm">
          Open this page in Chrome or Safari to install the app.
        </p>
      ) : ios ? (
        <ol className="mt-5 list-decimal space-y-2 rounded-xl bg-[#110f2e] p-4 pl-8 text-sm">
          <li>Open this page in Safari.</li>
          <li>Tap the Share button.</li>
          <li>Choose Add to Home Screen.</li>
          <li>Tap Add.</li>
        </ol>
      ) : (
        <button
          onClick={install}
          disabled={!deferred}
          className="mt-5 h-14 w-full rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-base font-semibold disabled:opacity-50"
        >
          {deferred ? "Install App" : "Open in Chrome to Install"}
        </button>
      )}

      {apk ? (
        <a
          href={apk}
          className="mt-3 block h-12 rounded-full border border-white/20 text-center text-sm leading-[3rem]"
        >
          Download Android APK
        </a>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Experience Maestra Vibe</h2>
        <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5">
          {shots.map((s) => (
            <img
              key={s}
              src={`/screenshots/${s}.png`}
              alt={`${s} preview`}
              className="h-80 shrink-0 snap-start rounded-2xl border border-white/10"
            />
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-white/10 bg-[#110f2e] p-5">
        <h2 className="mb-3 text-lg font-semibold">Everything in one place</h2>
        <ul className="space-y-2 text-sm text-[#c9c4e8]">
          {features.map((f) => (
            <li key={f}>✓ {f}</li>
          ))}
        </ul>
      </section>

      <section className="mt-6 rounded-2xl border border-white/10 bg-[#110f2e] p-5">
        <h2 className="mb-2 text-lg font-semibold">What's new</h2>
        <p className="text-sm text-[#c9c4e8]">
          Faster feed, Vibe flame, status views, voice messages and a new look.
        </p>
      </section>

      <footer className="mt-8 text-center text-xs text-[#8983aa]">
        Your profile. Your community. Your vibe.
        <p className="mt-2">Powered by Maestra Vibe</p>
      </footer>
    </main>
  );
}
