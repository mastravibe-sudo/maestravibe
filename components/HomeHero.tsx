// path: maestra-vibe/components/HomeHero.tsx  (NEW file)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fonts, presets, profiles, rgba } from "@/lib/profiles";
import { typeInfo } from "@/lib/posts";
import { ME, useStore } from "@/lib/store";

const questions = [
  "What is one small win you're proud of this week?",
  "Which dream are you chasing right now?",
  "Which struggle taught you the most?",
  "What color describes your mood today, and why?",
  "Who helped you get where you are?",
  "What would you build if failure were impossible?",
  "What are you learning right now?",
];

function Hero() {
  const [k, setK] = useState("Sunset");
  const t = presets[k];
  return (
    <section className="grid items-center gap-10 py-12 md:grid-cols-2">
      <div>
        <h1 className="font-serif text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
          Your life. Your profile. Your vibe.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-zinc-400">
          Maestra Vibe is a personal website and a social feed in one place. Show your achievements, your
          struggles and your dreams, styled exactly the way you feel.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href={`/${ME}`} className="rounded-full bg-violet-500 px-6 py-3 font-semibold text-white hover:bg-violet-400">
            Build your profile
          </Link>
          <a href="#feed" className="rounded-full border border-white/20 px-6 py-3 font-semibold hover:bg-white/5">
            Explore the feed
          </a>
        </div>
      </div>

      {/* Live preview: click a vibe to restyle the card */}
      <div>
        <div
          className="rounded-3xl p-5 transition-all duration-500"
          style={{ background: `linear-gradient(135deg, ${t.bg1}, ${t.bg2})`, color: t.text, fontFamily: fonts[t.font] }}
        >
          <div
            className="p-5 text-center"
            style={{ background: rgba(t.card, t.cardAlpha), border: `1px solid ${rgba(t.text, 0.15)}`, borderRadius: t.radius }}
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl" style={{ background: t.accent }}>
              🚀
            </div>
            <p className="mt-3 text-xl font-bold">Your Name</p>
            <p className="text-sm opacity-70">Builder. Dreamer. Still learning.</p>
            <div className="mt-4 space-y-2 text-left text-sm">
              {["🏆 First sale (Verified ✓)", "🌠 2 of 5 dreams complete", "💪 Saving for my first car"].map((x) => (
                <p key={x} className="px-3 py-2" style={{ background: rgba(t.accent, 0.2), borderRadius: t.radius / 2 }}>
                  {x}
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          <span className="text-zinc-500">Try a vibe:</span>
          {Object.keys(presets).map((name) => (
            <button
              key={name}
              onClick={() => setK(name)}
              className={`rounded-full px-3 py-1 ${k === name ? "bg-white text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stories() {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Vibe Stories</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        <Link href={`/${ME}`} className="flex shrink-0 flex-col items-center gap-1">
          <div className="flex h-[70px] w-[70px] items-center justify-center rounded-full border-2 border-dashed border-white/30 text-2xl text-zinc-400">
            +
          </div>
          <span className="text-xs text-zinc-400">Your vibe</span>
        </Link>
        {profiles
          .filter((p) => p.username !== ME)
          .map((p) => (
            <Link key={p.username} href={`/${p.username}`} className="flex shrink-0 flex-col items-center gap-1">
              <div className="rounded-full p-[3px]" style={{ background: `linear-gradient(135deg, ${p.style.accent}, ${p.style.bg2})` }}>
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-zinc-950 bg-zinc-900 text-3xl">
                  {p.avatar}
                </div>
              </div>
              <span className="text-xs text-zinc-400">{p.username}</span>
            </Link>
          ))}
      </div>
    </section>
  );
}

function TodayVibe() {
  const st = useStore();
  const [q, setQ] = useState(questions[0]);
  const [a, setA] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setQ(questions[Math.floor(Date.now() / 864e5) % questions.length]);
  }, []);

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold">Today&apos;s Vibe</h2>
      <p className="mt-2 text-zinc-300">{q}</p>
      {done ? (
        <p className="mt-4 text-emerald-400">Shared to your feed ✓</p>
      ) : (
        <div className="mt-4 flex gap-2">
          <input
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="Your answer..."
            className="min-w-0 flex-1 rounded-full bg-zinc-800 px-4 py-2 text-sm outline-none"
          />
          <button
            onClick={() => {
              if (!a.trim()) return;
              st.addPost("vibe", `${a.trim()} (Today's Vibe: ${q})`);
              setA("");
              setDone(true);
            }}
            className="rounded-full bg-violet-500 px-4 py-2 text-sm font-medium text-white"
          >
            Share
          </button>
        </div>
      )}
    </section>
  );
}

function DreamProgress() {
  const [dreams, setDreams] = useState<{ text: string; done?: boolean }[]>([]);

  useEffect(() => {
    const load = () => {
      try {
        const saved = localStorage.getItem("mv-profile-" + ME);
        const prof = saved ? JSON.parse(saved) : profiles.find((p) => p.username === ME);
        const b = prof.blocks.find((x: { kind: string }) => x.kind === "checklist");
        setDreams(b?.items ?? []);
      } catch {}
    };
    load();
    window.addEventListener("mv-profile", load);
    return () => window.removeEventListener("mv-profile", load);
  }, []);

  const done = dreams.filter((d) => d.done).length;
  const pct = dreams.length ? Math.round((done / dreams.length) * 100) : 0;
  const next = dreams.find((d) => !d.done);

  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900 p-5">
      <h2 className="text-lg font-semibold">My dreams</h2>
      <p className="mt-2 text-zinc-300">
        {done} of {dreams.length} completed
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
        <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-sm text-zinc-500">{next ? `Next up: ${next.text}` : "Add your first dream on your profile."}</p>
      <Link href={`/${ME}`} className="mt-2 inline-block text-sm text-violet-300 hover:text-violet-200">
        Edit dreams
      </Link>
    </section>
  );
}

function Trending() {
  const { s } = useStore();
  const score = (p: { vibes: number; vibed: string[] }) => p.vibes + p.vibed.length;
  const top = s.posts
    .filter((p) => (p.type === "achievement" || p.type === "dream") && !p.repostOf && !s.blocked.includes(p.username))
    .sort((x, y) => score(y) - score(x))
    .slice(0, 3);

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Trending achievements and dreams</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {top.map((p) => {
          const a = profiles.find((x) => x.username === p.username)!;
          return (
            <Link
              key={p.id}
              href={`/${a.username}`}
              className="rounded-2xl border border-white/10 bg-zinc-900 p-4 hover:bg-zinc-800"
              style={{ borderTop: `3px solid ${a.style.accent}` }}
            >
              <p className="text-sm text-zinc-400">
                {typeInfo[p.type].icon} {a.name}
              </p>
              <p className="mt-2 line-clamp-3 text-sm">{p.text}</p>
              <p className="mt-3 text-xs text-orange-400">🔥 {score(p)}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function HomeHero() {
  return (
    <div className="space-y-8 pb-6">
      <Hero />
      <Stories />
      <div className="grid gap-4 md:grid-cols-2">
        <TodayVibe />
        <DreamProgress />
      </div>
      <Trending />
    </div>
  );
}