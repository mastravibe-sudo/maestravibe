export type Theme = {
  name: string;
  page: string;
  card: string;
  title: string;
  text: string;
  muted: string;
  accent: string;
  chip: string;
};

export const themes: Record<string, Theme> = {
  dark: {
    name: "Dark",
    page: "bg-zinc-950",
    card: "bg-zinc-900 border border-zinc-800",
    title: "text-white",
    text: "text-zinc-200",
    muted: "text-zinc-400",
    accent: "bg-violet-500 text-white",
    chip: "bg-zinc-800 text-zinc-200",
  },
  sunset: {
    name: "Sunset",
    page: "bg-gradient-to-br from-orange-400 via-pink-500 to-purple-600",
    card: "bg-white/20 backdrop-blur border border-white/30",
    title: "text-white",
    text: "text-white",
    muted: "text-white/70",
    accent: "bg-white text-pink-600",
    chip: "bg-white/25 text-white",
  },
  minimal: {
    name: "Minimal",
    page: "bg-stone-50",
    card: "bg-white border border-stone-200",
    title: "text-stone-900",
    text: "text-stone-700",
    muted: "text-stone-500",
    accent: "bg-stone-900 text-white",
    chip: "bg-stone-100 text-stone-700",
  },
};