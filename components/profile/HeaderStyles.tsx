// path: maestra-vibe/components/profile/HeaderStyles.tsx  (NEW file, components ke andar profile folder banao)
// Profile ke upar wale card ke 30 styles (10 layouts x 3 skins) aur profile picture ki 20 shapes.
// Sirf allow-list wale IDs save hote hain, koi bhi user-text CSS mein nahi jata.
import type { CSSProperties, ReactNode } from "react";
import type { ProfileTheme } from "@/lib/profile-schema";

export const HEADER_LAYOUTS = [
  { id: "row", name: "Classic" }, { id: "center", name: "Centered" }, { id: "cover", name: "Cover" },
  { id: "cover-center", name: "Cover centered" }, { id: "right", name: "Mirrored" }, { id: "compact", name: "Compact" },
  { id: "hero", name: "Hero" }, { id: "split", name: "Split" }, { id: "badge", name: "Badge" }, { id: "minimal", name: "Minimal" },
] as const;
export const HEADER_SKINS = [{ id: "glass", name: "Glass" }, { id: "solid", name: "Solid" }, { id: "outline", name: "Outline" }] as const;
export const AVATAR_RINGS = [{ id: "none", name: "No ring" }, { id: "accent", name: "Accent" }, { id: "white", name: "White" }] as const;

export const AVATAR_SHAPES: { id: string; name: string; clip: string }[] = [
  { id: "circle", name: "Circle", clip: "circle(50%)" },
  { id: "square", name: "Square", clip: "inset(0)" },
  { id: "rounded", name: "Rounded", clip: "inset(0 round 18%)" },
  { id: "squircle", name: "Squircle", clip: "inset(0 round 32%)" },
  { id: "hexagon", name: "Hexagon", clip: "polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%)" },
  { id: "octagon", name: "Octagon", clip: "polygon(30% 0, 70% 0, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0 70%, 0 30%)" },
  { id: "diamond", name: "Diamond", clip: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)" },
  { id: "triangle", name: "Triangle", clip: "polygon(50% 4%, 100% 92%, 0 92%)" },
  { id: "inverted", name: "Inverted triangle", clip: "polygon(0 8%, 100% 8%, 50% 96%)" },
  { id: "pentagon", name: "Pentagon", clip: "polygon(50% 0, 100% 38%, 82% 100%, 18% 100%, 0 38%)" },
  { id: "star", name: "Star", clip: "polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)" },
  { id: "shield", name: "Shield", clip: "polygon(50% 0, 100% 12%, 100% 55%, 50% 100%, 0 55%, 0 12%)" },
  { id: "cross", name: "Cross", clip: "polygon(33% 0, 67% 0, 67% 33%, 100% 33%, 100% 67%, 67% 67%, 67% 100%, 33% 100%, 33% 67%, 0 67%, 0 33%, 33% 33%)" },
  { id: "arch", name: "Arch", clip: "inset(0 round 50% 50% 0 0)" },
  { id: "leaf", name: "Leaf", clip: "inset(0 round 0 50% 0 50%)" },
  { id: "parallelogram", name: "Slant", clip: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" },
  { id: "trapezoid", name: "Trapezoid", clip: "polygon(20% 0, 80% 0, 100% 100%, 0 100%)" },
  { id: "chevron", name: "Chevron", clip: "polygon(0 0, 70% 0, 100% 50%, 70% 100%, 0 100%, 30% 50%)" },
  { id: "blob", name: "Blob", clip: "inset(0 round 60% 40% 55% 45% / 45% 55% 40% 60%)" },
  { id: "blob2", name: "Blob 2", clip: "inset(0 round 40% 60% 45% 55% / 60% 40% 55% 45%)" },
];

type LayoutId = (typeof HEADER_LAYOUTS)[number]["id"];
type SkinId = (typeof HEADER_SKINS)[number]["id"];

export function parseHeaderStyle(raw: unknown): { layout: LayoutId; skin: SkinId } {
  const s = typeof raw === "string" ? raw : "";
  const i = s.lastIndexOf("-");
  return {
    layout: HEADER_LAYOUTS.find((l) => l.id === s.slice(0, i))?.id ?? "row",
    skin: HEADER_SKINS.find((k) => k.id === s.slice(i + 1))?.id ?? "glass",
  };
}
const shapeOf = (raw: unknown) => AVATAR_SHAPES.find((s) => s.id === raw) ?? AVATAR_SHAPES[0];
const ringOf = (raw: unknown) => AVATAR_RINGS.find((r) => r.id === raw) ?? AVATAR_RINGS[0];

export function headerSkinStyle(skin: SkinId, theme: ProfileTheme): { backgroundColor: string; color: string; boxShadow: string } {
  if (skin === "solid") return { backgroundColor: theme.pageAlt, color: theme.text, boxShadow: "none" };
  if (skin === "outline") return { backgroundColor: "transparent", color: theme.text, boxShadow: `inset 0 0 0 2px ${theme.accent}` };
  return { backgroundColor: "rgba(255,255,255,0.1)", color: theme.text, boxShadow: "none" };
}

export function AvatarShape({ src, name, shape, ring, size, accent }: { src?: string | null; name: string; shape: string; ring: string; size: number; accent: string }) {
  const clip = shapeOf(shape).clip;
  const ringPx = ring === "none" ? 0 : Math.max(2, Math.round(size / 24));
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size, clipPath: clip, background: ringPx ? (ring === "white" ? "#ffffff" : accent) : "transparent" }}>
      <span className="absolute flex items-center justify-center overflow-hidden bg-zinc-700 font-semibold text-white" style={{ inset: ringPx, clipPath: clip, fontSize: size / 2.5 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : (name || "?").slice(0, 1).toUpperCase()}
      </span>
    </span>
  );
}

type HeaderProfile = { name?: string | null; username: string; avatar_url?: string | null; banner_url?: string | null; theme: ProfileTheme };

export function HeaderBlock({ profile, style, action }: { profile: HeaderProfile; style: Record<string, unknown>; action?: ReactNode }) {
  const { layout } = parseHeaderStyle(style.headerStyle);
  const shape = shapeOf(style.avatarShape).id;
  const ring = ringOf(style.avatarRing).id;
  const t = profile.theme;
  const display = profile.name || profile.username;
  const av = (size: number) => <AvatarShape src={profile.avatar_url} name={display} shape={shape} ring={ring} size={size} accent={t.accent} />;
  const nameEl = (size = "1.55em", cls = "") => <h1 className={`truncate font-bold ${cls}`} style={{ fontFamily: t.fontHeading, fontSize: size }}>{display}</h1>;
  const userEl = <p className="truncate opacity-70">@{profile.username}</p>;
  const cover = (
    <div className="min-h-10 flex-[0_0_52%] overflow-hidden rounded-lg" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.pageAlt})` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {profile.banner_url ? <img src={profile.banner_url} alt="" className="h-full w-full object-cover" /> : null}
    </div>
  );

  switch (layout) {
    case "right":
      return <div className="flex h-full flex-row-reverse items-center gap-4">{av(64)}<div className="min-w-0 flex-1 text-right">{nameEl()}{userEl}</div>{action}</div>;
    case "center":
      return <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">{av(80)}{nameEl("1.55em", "max-w-full")}{userEl}{action}</div>;
    case "compact":
      return <div className="flex h-full items-center gap-3">{av(40)}<p className="min-w-0 flex-1 truncate"><span className="font-bold" style={{ fontFamily: t.fontHeading }}>{display}</span> <span className="opacity-70">@{profile.username}</span></p>{action}</div>;
    case "cover":
      return <div className="flex h-full flex-col">{cover}<div className="relative -mt-8 flex items-end gap-3 px-2">{av(72)}<div className="min-w-0 flex-1 pb-1">{nameEl("1.3em")}{userEl}</div>{action}</div></div>;
    case "cover-center":
      return <div className="flex h-full flex-col">{cover}<div className="relative -mt-9 flex flex-col items-center gap-1 text-center">{av(72)}{nameEl("1.3em", "max-w-full")}{userEl}{action}</div></div>;
    case "hero":
      return <div className="flex h-full items-center gap-5">{av(112)}<div className="min-w-0 flex-1"><h1 className="font-extrabold leading-tight" style={{ fontFamily: t.fontHeading, fontSize: "2em", overflowWrap: "anywhere" }}>{display}</h1>{userEl}<div className="mt-2">{action}</div></div></div>;
    case "split":
      return <div className="flex h-full overflow-hidden rounded-lg"><div className="flex w-1/3 items-center justify-center" style={{ background: t.accentSoft }}>{av(64)}</div><div className="flex min-w-0 flex-1 flex-col justify-center gap-1 pl-4">{nameEl()}{userEl}<div>{action}</div></div></div>;
    case "badge":
      return <div className="flex h-full items-center justify-center gap-3"><div className="flex min-w-0 items-center gap-3 rounded-full py-1.5 pl-1.5 pr-5" style={{ background: t.accentSoft }}>{av(56)}<div className="min-w-0">{nameEl("1.2em")}{userEl}</div></div>{action}</div>;
    case "minimal":
      return <div className="flex h-full flex-col justify-center gap-1"><h1 className="truncate font-black leading-none" style={{ fontFamily: t.fontHeading, fontSize: "2.2em" }}>{display}</h1><div className="flex items-center gap-2">{av(28)}<span className="opacity-70">@{profile.username}</span>{action}</div></div>;
    default:
      return <div className="flex h-full items-center gap-4">{av(64)}<div className="min-w-0 flex-1">{nameEl()}{userEl}</div>{action}</div>;
  }
}

export function HeaderStylePicker({ style, theme, onChange }: { style: Record<string, unknown>; theme: ProfileTheme; onChange: (key: string, value: unknown) => void }) {
  const cur = parseHeaderStyle(style.headerStyle);
  const shape = shapeOf(style.avatarShape).id;
  const ring = ringOf(style.avatarRing).id;
  const sample: HeaderProfile = { name: "Your Name", username: "you", avatar_url: null, banner_url: null, theme };
  const skin = headerSkinStyle(cur.skin, theme);
  const chip = (on: boolean) => `rounded-full px-3 py-1 text-xs ${on ? "bg-violet-500 text-white" : "bg-zinc-800 text-zinc-300"}`;
  const wrap: CSSProperties = { ...skin, fontFamily: theme.fontBody, borderRadius: 18 };

  return (
    <div className="mb-3 space-y-3 border-t border-white/10 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-400">Header style (30 looks)</p>
        <button onClick={() => { onChange("headerStyle", "row-glass"); onChange("avatarShape", "circle"); onChange("avatarRing", "none"); }} className="text-xs text-zinc-400 hover:text-white">Reset to default</button>
      </div>
      <div className="flex gap-2">
        {HEADER_SKINS.map((k) => <button key={k.id} onClick={() => onChange("headerStyle", `${cur.layout}-${k.id}`)} aria-pressed={cur.skin === k.id} className={chip(cur.skin === k.id)}>{k.name}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {HEADER_LAYOUTS.map((l) => (
          <button key={l.id} onClick={() => onChange("headerStyle", `${l.id}-${cur.skin}`)} aria-label={`${l.name} header`} aria-pressed={cur.layout === l.id} className={`overflow-hidden rounded-lg border text-left ${cur.layout === l.id ? "border-violet-400" : "border-white/10"}`}>
            <span className="block h-16 overflow-hidden" style={{ background: theme.page }}>
              <span className="block origin-top-left" style={{ width: 400, height: 170, transform: "scale(0.33)" }}>
                <span className="block h-full w-full p-4" style={wrap}>
                  <HeaderBlock profile={sample} style={{ headerStyle: `${l.id}-${cur.skin}`, avatarShape: shape, avatarRing: ring }} />
                </span>
              </span>
            </span>
            <span className="block px-2 py-1 text-[11px] text-zinc-300">{l.name}</span>
          </button>
        ))}
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-400">Profile picture shape</p>
        <div className="grid grid-cols-5 gap-2">
          {AVATAR_SHAPES.map((s) => (
            <button key={s.id} onClick={() => onChange("avatarShape", s.id)} aria-label={s.name} aria-pressed={shape === s.id} className={`rounded-md p-1 ${shape === s.id ? "bg-violet-500/30 ring-1 ring-violet-400" : "hover:bg-white/5"}`}>
              <span className="mx-auto block h-9 w-9" style={{ clipPath: s.clip, background: theme.accent }} />
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400">Ring</span>
        {AVATAR_RINGS.map((r) => <button key={r.id} onClick={() => onChange("avatarRing", r.id)} aria-pressed={ring === r.id} className={chip(ring === r.id)}>{r.name}</button>)}
      </div>
    </div>
  );
}