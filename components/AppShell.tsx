// path: maestra-vibe/components/AppShell.tsx  (poori file replace karo)
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { profiles } from "@/lib/profiles";
import { ME, useStore } from "@/lib/store";

const nav = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: `/${ME}`, label: "My Profile", icon: "👤" },
];

// Vibe Packs: naya user ek click mein poori community follow kar sakta hai
const packs = [
  { name: "Business Vibes", icon: "🏢", desc: "Dukaandar aur entrepreneurs", users: ["bilal", "nova"] },
  { name: "Creative Vibes", icon: "🎨", desc: "Designers aur artists", users: ["sara", "nova"] },
  { name: "Everyone", icon: "✨", desc: "Sab se milo", users: ["bilal", "sara", "nova"] },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const st = useStore();
  const { s } = st;
  const others = profiles.filter((p) => p.username !== ME);

  return (
    <>
      <div className="mx-auto flex min-h-screen max-w-7xl">
        {/* Left menu */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-2 border-r border-white/10 p-5 md:flex">
          <Link
            href="/"
            className="mb-6 bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-2xl font-extrabold text-transparent"
          >
            Maestra Vibe
          </Link>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-lg transition hover:bg-white/10 ${
                pathname === n.href ? "bg-white/10 font-semibold" : "text-zinc-400"
              }`}
            >
              <span>{n.icon}</span>
              {n.label}
            </Link>
          ))}
        </aside>

        {/* Center */}
        <div className="min-w-0 flex-1 pb-20 md:pb-0">{children}</div>

        {/* Right suggestions */}
        <aside className="sticky top-0 hidden h-screen w-80 shrink-0 p-5 xl:block">
          <h3 className="mb-3 font-semibold text-zinc-300">Rising Vibes 🔥</h3>
          <div className="space-y-2">
            {others
              .filter((p) => !s.blocked.includes(p.username))
              .map((p) => (
                <div key={p.username} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/5">
                  <Link
                    href={`/${p.username}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
                    style={{ background: p.style.accent }}
                  >
                    {p.avatar}
                  </Link>
                  <Link href={`/${p.username}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight">{p.name}</p>
                    <p className="text-sm text-zinc-500">@{p.username}</p>
                  </Link>
                  <button
                    onClick={() => st.follow(p.username)}
                    className={`rounded-full px-3 py-1 text-sm ${
                      s.following.includes(p.username) ? "bg-zinc-800 text-zinc-300" : "bg-violet-500 text-white"
                    }`}
                  >
                    {s.following.includes(p.username) ? "Following" : "Follow"}
                  </button>
                </div>
              ))}
          </div>
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-white/10 bg-zinc-950/90 p-3 backdrop-blur md:hidden">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`flex flex-col items-center text-xs ${pathname === n.href ? "text-white" : "text-zinc-500"}`}
          >
            <span className="text-2xl">{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>

      {/* Vibe Packs (pehli baar khulne par) */}
      {!s.onboarded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-6">
            <h2 className="text-2xl font-bold">Apni community chuno</h2>
            <p className="mt-1 text-sm text-zinc-400">Ek pack chuno aur us ke log ek click mein follow ho jayenge.</p>
            <div className="mt-4 space-y-3">
              {packs.map((pk) => (
                <button
                  key={pk.name}
                  onClick={() => st.followMany(pk.users)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-4 text-left hover:bg-white/5"
                >
                  <span className="text-3xl">{pk.icon}</span>
                  <span className="flex-1">
                    <span className="block font-semibold">{pk.name}</span>
                    <span className="text-sm text-zinc-400">{pk.desc}</span>
                  </span>
                  <span className="rounded-full bg-violet-500 px-3 py-1 text-sm text-white">Follow all</span>
                </button>
              ))}
            </div>
            <button onClick={st.skip} className="mt-4 w-full text-sm text-zinc-500 hover:text-white">
              Abhi nahi, baad mein
            </button>
          </div>
        </div>
      )}
    </>
  );
}