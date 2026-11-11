"use client";

import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import ProfileRender from "@/components/ProfileRender";
import { HeaderStylePicker } from "@/components/profile/HeaderStyles";
import { StatsStylePicker } from "@/components/profile/StatsStyles";
import { templateCatalog, type TemplateId } from "@/lib/templates";
import type { ProfileBlock, ProfileRecord, ProfileTheme } from "@/lib/profile-schema";

type Identity = {
  name: string;
  bio: string;
  avatar_url: string;
  banner_url: string;
  visibility: ProfileRecord["visibility"];
  template: TemplateId;
};

const STEPS = ["Profile", "Look", "Background", "Top banner", "Follower bar", "Text", "Preview"] as const;
const FONTS = [
  ["Inter", "Inter"],
  ["Editorial", "Georgia, serif"],
  ["Classic", "Arial, sans-serif"],
  ["Mono", "monospace"],
] as const;
const TEXT_BLOCKS = ["about", "text", "quote"];

const field = "w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 outline-none focus:border-violet-400";
const label = "mb-1.5 block text-xs font-medium text-zinc-400";
const pick = (on: boolean) =>
  `rounded-2xl border p-3 text-left text-sm ${on ? "border-violet-300 bg-violet-400/10 ring-2 ring-violet-400/30" : "border-white/10 bg-white/[0.03]"}`;

export default function ProfileWizard({
  username,
  identity,
  setIdentity,
  theme,
  setTheme,
  blocks,
  setBlockStyle,
  previewProfile,
  stats,
  applyTemplate,
  uploadControl,
  uploading,
  saving,
  error,
  onFinish,
  onSkipAll,
  onOpenFullEditor,
}: {
  username: string;
  identity: Identity;
  setIdentity: Dispatch<SetStateAction<Identity>>;
  theme: ProfileTheme;
  setTheme: Dispatch<SetStateAction<ProfileTheme>>;
  blocks: ProfileBlock[];
  setBlockStyle: (id: string, key: string, value: unknown) => void;
  previewProfile: ProfileRecord;
  stats: { followers: number; following: number };
  applyTemplate: (id: TemplateId) => void;
  uploadControl: (kind: "avatar" | "banner") => ReactNode;
  uploading: string | null;
  saving: boolean;
  error: string | null;
  onFinish: () => void;
  onSkipAll: () => void;
  onOpenFullEditor: () => void;
}) {
  const [step, setStep] = useState(0);
  const [textSize, setTextSize] = useState(16);
  const last = STEPS.length - 1;
  const header = blocks.find((b) => b.type === "header");
  const statsBlock = blocks.find((b) => b.type === "stats");
  const busy = saving || uploading !== null;

  const changeTextSize = (value: number) => {
    setTextSize(value);
    blocks.filter((b) => TEXT_BLOCKS.includes(b.type)).forEach((b) => setBlockStyle(b.id, "fontSize", value));
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col px-3 pb-28 text-zinc-100 sm:px-5">
      <header className="sticky top-0 z-30 -mx-3 border-b border-white/10 bg-zinc-950/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300">Set up @{username}</p>
            <h1 className="text-lg font-semibold">Step {step + 1} of {STEPS.length}: {STEPS[step]}</h1>
          </div>
          <button onClick={onSkipAll} disabled={busy} className="min-h-11 rounded-xl px-3 text-xs text-zinc-400 hover:text-white disabled:opacity-50">
            Skip setup
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </header>

      <div className="mt-3 grid flex-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="sticky top-[88px] z-20 order-1 bg-zinc-950 pb-2 lg:order-2 lg:top-24">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">Live preview</p>
          <div className="h-[28dvh] max-h-[280px] overflow-hidden rounded-xl border border-white/10 lg:h-[calc(100dvh-9rem)] lg:max-h-none">
  <div className="origin-top scale-[0.92] lg:scale-100">
    <ProfileRender profile={previewProfile} stats={stats} />
  </div>
</div>
        </div>

        <section className="order-2 space-y-4 rounded-xl border border-white/10 bg-zinc-900/70 p-4 lg:order-1">
          {step === 0 ? (
            <>
              <h2 className="text-base font-semibold">Your photo, name and bio</h2>
              <div>{uploadControl("avatar")}</div>
              <label className="block"><span className={label}>Display name</span>
                <input value={identity.name} maxLength={80} onChange={(e) => setIdentity((c) => ({ ...c, name: e.target.value }))} className={field} />
              </label>
              <label className="block"><span className={label}>Bio</span>
                <textarea rows={4} maxLength={400} value={identity.bio} onChange={(e) => setIdentity((c) => ({ ...c, bio: e.target.value }))} className={`${field} resize-y`} />
              </label>
              <p className="text-xs text-zinc-500">Your ID is @{username}.</p>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <h2 className="text-base font-semibold">Pick a starting look</h2>
              <p className="text-xs text-zinc-400">Colors, fonts and background change together. You can fine-tune everything next.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Object.values(templateCatalog).map((t) => (
                  <button key={t.id} onClick={() => applyTemplate(t.id)} aria-pressed={identity.template === t.id} className={pick(identity.template === t.id)}>
                    <span className="mb-2 block h-12 rounded-lg" style={{ background: t.background.value }} />
                    <span className="font-semibold">{t.name}</span>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <h2 className="text-base font-semibold">Background</h2>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setTheme((c) => ({ ...c, backgroundType: "gradient" }))} aria-pressed={theme.backgroundType === "gradient"} className={pick(theme.backgroundType === "gradient")}>
                  <span className="mb-2 block h-12 rounded-lg" style={{ background: theme.backgroundValue }} />Gradient
                </button>
                <button onClick={() => setTheme((c) => ({ ...c, backgroundType: "solid" }))} aria-pressed={theme.backgroundType === "solid"} className={pick(theme.backgroundType === "solid")}>
                  <span className="mb-2 block h-12 rounded-lg" style={{ background: theme.page }} />Solid color
                </button>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm">
                <span>Page color</span>
                <input aria-label="Page color" type="color" value={theme.page} onChange={(e) => setTheme((c) => ({ ...c, page: e.target.value }))} className="h-10 w-14 cursor-pointer border-0 bg-transparent p-0" />
              </label>
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm">
                <span>Accent color</span>
                <input aria-label="Accent color" type="color" value={theme.accent} onChange={(e) => setTheme((c) => ({ ...c, accent: e.target.value }))} className="h-10 w-14 cursor-pointer border-0 bg-transparent p-0" />
              </label>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <h2 className="text-base font-semibold">Top banner</h2>
              <div>{uploadControl("banner")}</div>
              {header ? (
                <HeaderStylePicker style={header.style} theme={theme} onChange={(key, value) => setBlockStyle(header.id, key, value)} />
              ) : <p className="text-xs text-zinc-500">No header section found. Skip this step.</p>}
            </>
          ) : null}

          {step === 4 ? (
            <>
              <h2 className="text-base font-semibold">Follower bar</h2>
              {statsBlock ? (
                <StatsStylePicker style={statsBlock.style} theme={theme} onChange={(key, value) => setBlockStyle(statsBlock.id, key, value)} />
              ) : <p className="text-xs text-zinc-500">No stats section found. Skip this step.</p>}
            </>
          ) : null}

          {step === 5 ? (
            <>
              <h2 className="text-base font-semibold">Text</h2>
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 px-4 py-3 text-sm">
                <span>Text color</span>
                <input aria-label="Text color" type="color" value={theme.text} onChange={(e) => setTheme((c) => ({ ...c, text: e.target.value }))} className="h-10 w-14 cursor-pointer border-0 bg-transparent p-0" />
              </label>
              <label className="block space-y-1.5">
                <span className="flex justify-between text-xs text-zinc-400"><span>Text size (about, text, quote)</span><span>{textSize}</span></span>
                <input type="range" min={10} max={40} value={textSize} onChange={(e) => changeTextSize(Number(e.target.value))} className="w-full accent-violet-400" />
              </label>
              <div>
                <p className={label}>Font</p>
                <div className="grid grid-cols-2 gap-2">
                  {FONTS.map(([name, value]) => (
                    <button key={name} onClick={() => setTheme((c) => ({ ...c, fontHeading: value, fontBody: name === "Editorial" ? "Inter" : value }))} aria-pressed={theme.fontHeading === value} className={pick(theme.fontHeading === value)}>
                      <span className="text-xl" style={{ fontFamily: value }}>Ag</span>
                      <span className="mt-1 block font-semibold">{name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {step === last ? (
            <>
              <h2 className="text-base font-semibold">Your profile is ready.</h2>
              <p className="text-sm text-zinc-400">Check the preview. Nothing is saved until you press Save. Go back to change anything.</p>
              <button onClick={onOpenFullEditor} className="text-xs text-violet-300 underline">Open the full editor instead</button>
            </>
          ) : null}

          {error ? <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/60 p-3 text-sm text-red-200">{error}</p> : null}
        </section>
      </div>

<footer className="fixed inset-x-0 bottom-16 z-50 border-t border-white/10 bg-zinc-950/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:bottom-0">        <div className="mx-auto flex max-w-6xl items-center gap-2">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || busy} className="min-h-12 rounded-2xl border border-white/10 px-5 text-sm disabled:opacity-40">Back</button>
          <div className="flex-1" />
          {step > 0 && step < last ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={busy} className="min-h-12 rounded-2xl px-4 text-sm text-zinc-400 hover:text-white">Skip</button>
          ) : null}
          {step < last ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={busy} className="min-h-12 rounded-2xl bg-violet-500 px-6 text-sm font-bold text-white disabled:opacity-50">
              {uploading ? "Uploading..." : "Next"}
            </button>
          ) : (
            <button onClick={onFinish} disabled={busy} className="min-h-12 rounded-2xl bg-violet-500 px-6 text-sm font-bold text-white disabled:opacity-50">
              {saving ? "Saving..." : "Save profile"}
            </button>
          )}
        </div>
      </footer>
    </main>
  );
}