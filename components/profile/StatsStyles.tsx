// path: maestra-vibe/components/profile/StatsStyles.tsx  (NEW file)
// Followers / Following / Vibes / Posts card ke 30 styles (10 layouts x 3 skins).
import type { CSSProperties } from "react";
import { Flame, LayoutGrid, UserCheck, Users } from "lucide-react";
import type { ProfileTheme } from "@/lib/profile-schema";

export type Stats = { followers: number; following: number; vibes: number; posts: number };

export const STATS_LAYOUTS = [
  { id: "boxes", name: "Boxes" }, { id: "row", name: "Inline" }, { id: "pills", name: "Pills" }, { id: "circles", name: "Circles" },
  { id: "stack", name: "List" }, { id: "big", name: "Big numbers" }, { id: "ticket", name: "Ticket" }, { id: "underline", name: "Underline" },
  { id: "icons", name: "Icons" }, { id: "compact", name: "Compact" },
] as const;
export const STATS_SKINS = [{ id: "card", name: "Card" }, { id: "flat", name: "Flat" }, { id: "accent", name: "Accent" }] as const;
type LayoutId = (typeof STATS_LAYOUTS)[number]["id"];
type SkinId = (typeof STATS_SKINS)[number]["id"];

export function parseStatsStyle(raw: unknown): { layout: LayoutId; skin: SkinId } {
  const s = typeof raw === "string" ? raw : "";
  const i = s.lastIndexOf("-");
  return {
    layout: STATS_LAYOUTS.find((l) => l.id === s.slice(0, i))?.id ?? "boxes",
    skin: STATS_SKINS.find((k) => k.id === s.slice(i + 1))?.id ?? "card",
  };
}

const skinBox = (skin: SkinId, t: ProfileTheme): CSSProperties =>
  skin === "flat" ? { background: "transparent", border: "1px solid transparent" }
  : skin === "accent" ? { background: t.accentSoft, border: `1px solid ${t.accent}` }
  : { background: "rgba(0,0,0,0.12)", border: "1px solid rgba(255,255,255,0.1)" };

const num = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v));

export function StatsBlock({ stats, style, theme }: { stats: Stats; style: Record<string, unknown>; theme: ProfileTheme }) {
  const { layout, skin } = parseStatsStyle(style.statsStyle);
  const box = skinBox(skin, theme);
  const items = [
    { k: "Followers", v: stats.followers, Icon: Users }, { k: "Following", v: stats.following, Icon: UserCheck },
    { k: "Vibes", v: stats.vibes, Icon: Flame }, { k: "Posts", v: stats.posts, Icon: LayoutGrid },
  ];
  const label = "text-[0.7em] uppercase opacity-65";

  switch (layout) {
    case "row":
      return <div className="flex h-full items-center justify-around gap-2 rounded-xl px-2" style={box}>{items.map((it, n) => <div key={it.k} className="flex items-center gap-3">{n ? <span className="h-6 w-px bg-current opacity-25" /> : null}<div className="text-center"><div className="text-lg font-bold leading-tight">{num(it.v)}</div><div className={label}>{it.k}</div></div></div>)}</div>;
    case "pills":
      return <div className="flex h-full flex-wrap items-center gap-2">{items.map((it) => <span key={it.k} className="rounded-full px-4 py-1.5 text-sm" style={box}><b>{num(it.v)}</b> <span className="opacity-70">{it.k}</span></span>)}</div>;
    case "circles":
      return <div className="flex h-full items-center justify-around gap-2">{items.map((it) => <div key={it.k} className="flex aspect-square h-full max-h-24 flex-col items-center justify-center rounded-full text-center" style={box}><span className="font-bold leading-tight">{num(it.v)}</span><span className={label}>{it.k}</span></div>)}</div>;
    case "stack":
      return <div className="flex h-full flex-col justify-center gap-1.5">{items.map((it) => <div key={it.k} className="flex items-center justify-between rounded-lg px-3 py-1.5" style={box}><span className="opacity-75">{it.k}</span><b>{num(it.v)}</b></div>)}</div>;
    case "big":
      return <div className="flex h-full items-end justify-around gap-2 rounded-xl px-3 py-2" style={box}>{items.map((it) => <div key={it.k} className="text-center"><div className="font-black leading-none" style={{ fontSize: "2.2em", fontFamily: theme.fontHeading }}>{num(it.v)}</div><div className={`mt-1 ${label}`}>{it.k}</div></div>)}</div>;
    case "ticket":
      return <div className="grid h-full grid-cols-2 gap-2 sm:grid-cols-4">{items.map((it) => <div key={it.k} className="flex flex-col items-center justify-center rounded-md border-2 border-dashed px-2 text-center" style={{ ...box, borderColor: theme.accent }}><span className="text-lg font-bold">{num(it.v)}</span><span className={label}>{it.k}</span></div>)}</div>;
    case "underline":
      return <div className="flex h-full items-center justify-around gap-2">{items.map((it) => <div key={it.k} className="border-b-2 px-2 pb-1 text-center" style={{ borderColor: theme.accent }}><div className="text-lg font-bold">{num(it.v)}</div><div className={label}>{it.k}</div></div>)}</div>;
    case "icons":
      return <div className="grid h-full grid-cols-2 gap-2 sm:grid-cols-4">{items.map((it) => <div key={it.k} className="flex items-center gap-2 rounded-xl px-3 py-2" style={box}><it.Icon className="h-5 w-5 shrink-0" style={{ color: theme.accent }} aria-hidden="true" /><div><div className="font-bold leading-tight">{num(it.v)}</div><div className={label}>{it.k}</div></div></div>)}</div>;
    case "compact":
      return <p className="flex h-full items-center justify-center rounded-xl px-3 text-center text-sm" style={box}>{items.map((it) => `${num(it.v)} ${it.k.toLowerCase()}`).join(" · ")}</p>;
    default:
      return <div className="grid h-full grid-cols-2 gap-2 sm:grid-cols-4">{items.map((it) => <div key={it.k} className="flex flex-col items-center justify-center rounded-xl px-2 text-center" style={box}><span className="text-xl font-bold">{num(it.v)}</span><span className={label}>{it.k}</span></div>)}</div>;
  }
}

export function StatsStylePicker({ style, theme, onChange }: { style: Record<string, unknown>; theme: ProfileTheme; onChange: (key: string, value: unknown) => void }) {
  const cur = parseStatsStyle(style.statsStyle);
  const sample: Stats = { followers: 128, following: 54, vibes: 940, posts: 36 };
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-xs ${on ? "bg-violet-500 text-white" : "bg-zinc-800 text-zinc-300"}`;
  return (
    <div className="mb-3 space-y-3 border-t border-white/10 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-400">Stats style (30 looks)</p>
        <button onClick={() => onChange("statsStyle", "boxes-card")} className="text-xs text-zinc-400 hover:text-white">Reset to default</button>
      </div>
      <div className="flex gap-2">
        {STATS_SKINS.map((k) => <button key={k.id} onClick={() => onChange("statsStyle", `${cur.layout}-${k.id}`)} aria-pressed={cur.skin === k.id} className={chip(cur.skin === k.id)}>{k.name}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {STATS_LAYOUTS.map((l) => (
          <button key={l.id} onClick={() => onChange("statsStyle", `${l.id}-${cur.skin}`)} aria-label={`${l.name} stats`} aria-pressed={cur.layout === l.id} className={`overflow-hidden rounded-lg border text-left ${cur.layout === l.id ? "border-violet-400" : "border-white/10"}`}>
            <span className="block h-16 overflow-hidden" style={{ background: theme.page }}>
              <span className="block origin-top-left" style={{ width: 400, height: 170, transform: "scale(0.33)" }}>
                <span className="block h-full w-full p-4" style={{ color: theme.text, fontFamily: theme.fontBody }}>
                  <StatsBlock stats={sample} style={{ statsStyle: `${l.id}-${cur.skin}` }} theme={theme} />
                </span>
              </span>
            </span>
            <span className="block px-2 py-1 text-[11px] text-zinc-300">{l.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}