import type { ProfileBlock, ProfileSticker, ProfileTheme } from "@/lib/profile-schema";

export const LEGACY_TEMPLATE_IDS = [
  "aurora",
  "noir",
  "editorial",
  "neon-night",
  "pastel-studio",
  "executive",
  "brutalist",
  "sunset-polaroid",
  "forest-calm",
  "retro-terminal",
] as const;

export const PERSONALITY_TEMPLATE_IDS = [
  "savage-dark",
  "aura-mystic",
  "gamer-neon",
  "professional-business",
  "minimal-clean",
  "soft-aesthetic-pastel",
  "royal-luxury-gold",
  "anime",
  "nature-calm",
  "retro-vaporwave",
  "artist-creative",
  "musician",
  "funny-meme",
  "romantic",
  "sporty-fitness",
  "techie-hacker",
] as const;

export const TEMPLATE_IDS = [...LEGACY_TEMPLATE_IDS, ...PERSONALITY_TEMPLATE_IDS] as const;
type LegacyTemplateId = (typeof LEGACY_TEMPLATE_IDS)[number];
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export type TemplateDefinition = {
  id: TemplateId;
  name: string;
  description: string;
  fonts: {
    heading: string;
    body: string;
  };
  colors: {
    page: string;
    pageAlt: string;
    card: string;
    cardAlt: string;
    text: string;
    textMuted: string;
    accent: string;
    accentSoft: string;
    border: string;
    buttonText: string;
  };
  background: {
    type: "solid" | "gradient" | "pattern" | "image";
    value: string;
    overlay: string;
  };
  radius: number;
  shadow: string;
  buttonStyle: "filled" | "outline" | "ghost";
  sectionSpacing: number;
  skin?: ProfileTheme["skin"];
  stickers?: ProfileSticker[];
};

const legacyTemplateCatalog: Record<LegacyTemplateId, TemplateDefinition> = {
  aurora: {
    id: "aurora",
    name: "Aurora",
    description: "Soft gradients and glassy panels with a futuristic glow.",
    fonts: { heading: "var(--font-display, 'Inter', sans-serif)", body: "var(--font-body, 'Inter', sans-serif)" },
    colors: {
      page: "#09090f",
      pageAlt: "#17172a",
      card: "rgba(17, 24, 39, 0.62)",
      cardAlt: "rgba(255,255,255,0.08)",
      text: "#f5f7ff",
      textMuted: "#c4c9dc",
      accent: "#8b5cf6",
      accentSoft: "rgba(139,92,246,0.18)",
      border: "rgba(255,255,255,0.12)",
      buttonText: "#ffffff",
    },
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 35%, #7c3aed 100%)",
      overlay: "rgba(15,23,42,0.28)",
    },
    radius: 24,
    shadow: "0 20px 60px rgba(96, 76, 175, 0.28)",
    buttonStyle: "filled",
    sectionSpacing: 24,
  },
  noir: {
    id: "noir",
    name: "Noir",
    description: "Dark, minimal and premium with strong contrast.",
    fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
    colors: {
      page: "#0b0b0d",
      pageAlt: "#141417",
      card: "#121215",
      cardAlt: "#17171b",
      text: "#f4f4f5",
      textMuted: "#a1a1aa",
      accent: "#d4d4d8",
      accentSoft: "rgba(212,212,216,0.12)",
      border: "rgba(255,255,255,0.08)",
      buttonText: "#111827",
    },
    background: { type: "solid", value: "#0b0b0d", overlay: "rgba(0,0,0,0.18)" },
    radius: 18,
    shadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
    buttonStyle: "outline",
    sectionSpacing: 18,
  },
  editorial: {
    id: "editorial",
    name: "Editorial",
    description: "Classic magazine styling with serif headlines and clean text blocks.",
    fonts: { heading: "'Playfair Display', serif", body: "'Inter', sans-serif" },
    colors: {
      page: "#f4efe7",
      pageAlt: "#f7f3ed",
      card: "rgba(255,255,255,0.72)",
      cardAlt: "rgba(255,255,255,0.88)",
      text: "#1d1b1a",
      textMuted: "#5b4b46",
      accent: "#996c58",
      accentSoft: "rgba(153,108,88,0.14)",
      border: "rgba(34,28,24,0.12)",
      buttonText: "#ffffff",
    },
    background: { type: "solid", value: "#f4efe7", overlay: "rgba(0,0,0,0.02)" },
    radius: 20,
    shadow: "0 18px 40px rgba(71, 43, 29, 0.08)",
    buttonStyle: "filled",
    sectionSpacing: 22,
  },
  "neon-night": {
    id: "neon-night",
    name: "Neon Night",
    description: "High-energy cyberpunk with electric colors and glowing accents.",
    fonts: { heading: "'Orbitron', sans-serif", body: "'Inter', sans-serif" },
    colors: {
      page: "#070b16",
      pageAlt: "#101a2b",
      card: "rgba(10, 16, 28, 0.78)",
      cardAlt: "rgba(17, 24, 39, 0.88)",
      text: "#ebf8ff",
      textMuted: "#9ad7ff",
      accent: "#22d3ee",
      accentSoft: "rgba(34,211,238,0.16)",
      border: "rgba(34,211,238,0.22)",
      buttonText: "#08111a",
    },
    background: {
      type: "gradient",
      value: "radial-gradient(circle at top, #0f172a 0%, #111827 20%, #020617 100%)",
      overlay: "rgba(34,211,238,0.08)",
    },
    radius: 22,
    shadow: "0 0 30px rgba(34,211,238,0.28)",
    buttonStyle: "filled",
    sectionSpacing: 26,
  },
  "pastel-studio": {
    id: "pastel-studio",
    name: "Pastel Studio",
    description: "A soft creative space with warm, playful colors.",
    fonts: { heading: "'Nunito', sans-serif", body: "'Inter', sans-serif" },
    colors: {
      page: "#fff8f4",
      pageAlt: "#f6efff",
      card: "rgba(255,255,255,0.7)",
      cardAlt: "rgba(255,255,255,0.9)",
      text: "#312e2b",
      textMuted: "#5f5a57",
      accent: "#ec4899",
      accentSoft: "rgba(236,72,153,0.14)",
      border: "rgba(95,90,87,0.12)",
      buttonText: "#ffffff",
    },
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #fff7ed 0%, #fdf2f8 45%, #eef2ff 100%)",
      overlay: "rgba(255,255,255,0.2)",
    },
    radius: 26,
    shadow: "0 18px 35px rgba(217, 70, 239, 0.12)",
    buttonStyle: "filled",
    sectionSpacing: 24,
  },
  executive: {
    id: "executive",
    name: "Executive",
    description: "Professional, minimal and polished for personal brands and portfolios.",
    fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
    colors: {
      page: "#f8fafc",
      pageAlt: "#e2e8f0",
      card: "rgba(255,255,255,0.86)",
      cardAlt: "rgba(248,250,252,0.94)",
      text: "#0f172a",
      textMuted: "#475569",
      accent: "#2563eb",
      accentSoft: "rgba(37,99,235,0.12)",
      border: "rgba(15,23,42,0.08)",
      buttonText: "#ffffff",
    },
    background: { type: "solid", value: "#f8fafc", overlay: "rgba(15,23,42,0.02)" },
    radius: 16,
    shadow: "0 14px 32px rgba(15, 23, 42, 0.08)",
    buttonStyle: "outline",
    sectionSpacing: 18,
  },
  brutalist: {
    id: "brutalist",
    name: "Brutalist",
    description: "Bold shapes, sharp edges, strong attitude.",
    fonts: { heading: "'Arial Black', sans-serif", body: "'Inter', sans-serif" },
    colors: {
      page: "#f5f5f4",
      pageAlt: "#e7e5e4",
      card: "#ffffff",
      cardAlt: "#f5f5f4",
      text: "#111111",
      textMuted: "#3f3f46",
      accent: "#111111",
      accentSoft: "rgba(17,17,17,0.08)",
      border: "rgba(17,17,17,0.18)",
      buttonText: "#ffffff",
    },
    background: { type: "solid", value: "#f5f5f4", overlay: "rgba(17,17,17,0.03)" },
    radius: 0,
    shadow: "0 10px 20px rgba(17,17,17,0.08)",
    buttonStyle: "filled",
    sectionSpacing: 22,
  },
  "sunset-polaroid": {
    id: "sunset-polaroid",
    name: "Sunset Polaroid",
    description: "Warm, photo-first, nostalgic and friendly.",
    fonts: { heading: "'Trebuchet MS', sans-serif", body: "'Inter', sans-serif" },
    colors: {
      page: "#fff7ed",
      pageAlt: "#fef2f2",
      card: "rgba(255,255,255,0.8)",
      cardAlt: "rgba(255,255,255,0.92)",
      text: "#1f2937",
      textMuted: "#6b7280",
      accent: "#f97316",
      accentSoft: "rgba(249,115,22,0.12)",
      border: "rgba(31,41,55,0.08)",
      buttonText: "#ffffff",
    },
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #fef3c7 0%, #fdba74 32%, #fb7185 100%)",
      overlay: "rgba(255,255,255,0.18)",
    },
    radius: 24,
    shadow: "0 20px 42px rgba(251, 113, 133, 0.2)",
    buttonStyle: "filled",
    sectionSpacing: 24,
  },
  "forest-calm": {
    id: "forest-calm",
    name: "Forest Calm",
    description: "Natural greens and grounded tones for a serene personal page.",
    fonts: { heading: "'Georgia', serif", body: "'Inter', sans-serif" },
    colors: {
      page: "#edf7ef",
      pageAlt: "#dbeede",
      card: "rgba(255,255,255,0.7)",
      cardAlt: "rgba(255,255,255,0.92)",
      text: "#17231a",
      textMuted: "#4d5f52",
      accent: "#2f7d52",
      accentSoft: "rgba(47,125,82,0.12)",
      border: "rgba(23,35,26,0.08)",
      buttonText: "#ffffff",
    },
    background: {
      type: "gradient",
      value: "linear-gradient(135deg, #eefbf0 0%, #dff3e2 35%, #c9eed0 100%)",
      overlay: "rgba(255,255,255,0.1)",
    },
    radius: 22,
    shadow: "0 16px 32px rgba(47,125,82,0.12)",
    buttonStyle: "outline",
    sectionSpacing: 20,
  },
  "retro-terminal": {
    id: "retro-terminal",
    name: "Retro Terminal",
    description: "Monospace and nostalgic, built for creators who love sharp details.",
    fonts: { heading: "'JetBrains Mono', monospace", body: "'JetBrains Mono', monospace" },
    colors: {
      page: "#09090b",
      pageAlt: "#111827",
      card: "rgba(15, 23, 42, 0.9)",
      cardAlt: "rgba(17,24,39,0.96)",
      text: "#d1fae5",
      textMuted: "#a7f3d0",
      accent: "#34d399",
      accentSoft: "rgba(52,211,153,0.14)",
      border: "rgba(52,211,153,0.2)",
      buttonText: "#04110b",
    },
    background: { type: "solid", value: "#09090b", overlay: "rgba(52,211,153,0.04)" },
    radius: 14,
    shadow: "0 0 24px rgba(52,211,153,0.18)",
    buttonStyle: "filled",
    sectionSpacing: 18,
  },
};

type PersonalityTemplate = Omit<TemplateDefinition, "id"> & { id: (typeof PERSONALITY_TEMPLATE_IDS)[number] };

const personalityTemplateData: PersonalityTemplate[] = [
  {
    id: "savage-dark", name: "Savage / Dark", description: "A sharp monochrome look with a violet edge.",
    fonts: { heading: "'Arial Black', sans-serif", body: "'Inter', sans-serif" },
    colors: { page: "#07061a", pageAlt: "#17132b", card: "rgba(18,16,34,.88)", cardAlt: "rgba(255,255,255,.06)", text: "#f4f2ff", textMuted: "#aaa6bd", accent: "#7c3aed", accentSoft: "rgba(124,58,237,.18)", border: "rgba(168,85,247,.25)", buttonText: "#ffffff" },
    background: { type: "gradient", value: "linear-gradient(135deg,#07061a,#17132b 58%,#3b0764)", overlay: "rgba(7,6,26,.18)" },
    radius: 14, shadow: "0 18px 42px rgba(124,58,237,.2)", buttonStyle: "filled", sectionSpacing: 20, skin: "glow",
    stickers: [{ id: "template-savage", type: "emoji", value: "⚡", x: 82, y: 12, size: 12, rotation: 12 }],
  },
  {
    id: "aura-mystic", name: "Aura / Mystic", description: "Dreamy indigo, violet and celestial details.",
    fonts: { heading: "'Cormorant Garamond', serif", body: "'Inter', sans-serif" },
    colors: { page: "#100a24", pageAlt: "#21143b", card: "rgba(33,20,59,.72)", cardAlt: "rgba(255,255,255,.08)", text: "#f7efff", textMuted: "#c5b4df", accent: "#a855f7", accentSoft: "rgba(168,85,247,.18)", border: "rgba(216,180,254,.2)", buttonText: "#ffffff" },
    background: { type: "gradient", value: "radial-gradient(circle at 20% 5%,#6b21a8 0%,#21143b 40%,#100a24 100%)", overlay: "rgba(16,10,36,.12)" },
    radius: 28, shadow: "0 20px 50px rgba(168,85,247,.2)", buttonStyle: "outline", sectionSpacing: 24, skin: "glass",
    stickers: [{ id: "template-aura", type: "emoji", value: "🌙", x: 80, y: 12, size: 14, rotation: -8 }],
  },
  {
    id: "gamer-neon", name: "Gamer Neon", description: "Electric cyan and violet with a powered-up glow.",
    fonts: { heading: "'Orbitron', sans-serif", body: "'Inter', sans-serif" },
    colors: { page: "#050b18", pageAlt: "#0d1b32", card: "rgba(8,19,37,.9)", cardAlt: "rgba(34,211,238,.1)", text: "#e7fbff", textMuted: "#8bbdca", accent: "#22d3ee", accentSoft: "rgba(34,211,238,.18)", border: "rgba(34,211,238,.28)", buttonText: "#041016" },
    background: { type: "gradient", value: "linear-gradient(135deg,#050b18,#172554 58%,#4c1d95)", overlay: "rgba(5,11,24,.15)" },
    radius: 12, shadow: "0 0 34px rgba(34,211,238,.24)", buttonStyle: "filled", sectionSpacing: 22, skin: "glow",
    stickers: [{ id: "template-gamer", type: "emoji", value: "🎮", x: 80, y: 12, size: 14, rotation: 6 }],
  },
  {
    id: "professional-business", name: "Professional / Business", description: "Polished navy and blue for a confident personal brand.",
    fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
    colors: { page: "#080d19", pageAlt: "#111c30", card: "rgba(17,28,48,.92)", cardAlt: "rgba(255,255,255,.06)", text: "#f1f5f9", textMuted: "#aab7ca", accent: "#3b82f6", accentSoft: "rgba(59,130,246,.16)", border: "rgba(148,163,184,.18)", buttonText: "#ffffff" },
    background: { type: "gradient", value: "linear-gradient(145deg,#080d19,#172554 72%,#1e3a8a)", overlay: "rgba(8,13,25,.1)" },
    radius: 18, shadow: "0 16px 38px rgba(2,6,23,.32)", buttonStyle: "filled", sectionSpacing: 20, skin: "flat",
    stickers: [{ id: "template-business", type: "emoji", value: "✦", x: 84, y: 14, size: 10, rotation: 0 }],
  },
  {
    id: "minimal-clean", name: "Minimal Clean", description: "Quiet charcoal surfaces, crisp typography and no clutter.",
    fonts: { heading: "'Inter', sans-serif", body: "'Inter', sans-serif" },
    colors: { page: "#0d0d12", pageAlt: "#19191f", card: "rgba(25,25,31,.94)", cardAlt: "rgba(255,255,255,.05)", text: "#f4f4f5", textMuted: "#a1a1aa", accent: "#a1a1aa", accentSoft: "rgba(161,161,170,.12)", border: "rgba(255,255,255,.09)", buttonText: "#111111" },
    background: { type: "solid", value: "#0d0d12", overlay: "transparent" },
    radius: 12, shadow: "0 12px 30px rgba(0,0,0,.24)", buttonStyle: "outline", sectionSpacing: 18, skin: "flat",
    stickers: [{ id: "template-minimal", type: "emoji", value: "✳", x: 86, y: 14, size: 9, rotation: 0 }],
  },
  {
    id: "soft-aesthetic-pastel", name: "Soft / Aesthetic Pastel", description: "Soft lilac, rose and lavender glass.",
    fonts: { heading: "'Nunito', sans-serif", body: "'Inter', sans-serif" },
    colors: { page: "#171020", pageAlt: "#2b1930", card: "rgba(45,28,51,.76)", cardAlt: "rgba(255,255,255,.1)", text: "#fff5fb", textMuted: "#d7bed0", accent: "#e879b9", accentSoft: "rgba(232,121,185,.18)", border: "rgba(249,168,212,.2)", buttonText: "#1d1020" },
    background: { type: "gradient", value: "linear-gradient(135deg,#21152b,#663b70 52%,#3b2349)", overlay: "rgba(23,16,32,.16)" },
    radius: 30, shadow: "0 18px 42px rgba(232,121,185,.16)", buttonStyle: "filled", sectionSpacing: 26, skin: "soft",
    stickers: [{ id: "template-pastel", type: "emoji", value: "🦋", x: 80, y: 11, size: 14, rotation: -7 }],
  },
  {
    id: "royal-luxury-gold", name: "Royal / Luxury Gold", description: "Deep midnight tones, elegant serif and restrained gold.",
    fonts: { heading: "'Playfair Display', serif", body: "'Inter', sans-serif" },
    colors: { page: "#100d0a", pageAlt: "#21190d", card: "rgba(34,27,17,.92)", cardAlt: "rgba(255,255,255,.06)", text: "#fff9e8", textMuted: "#d5c7a6", accent: "#d6ad55", accentSoft: "rgba(214,173,85,.16)", border: "rgba(214,173,85,.23)", buttonText: "#171109" },
    background: { type: "gradient", value: "linear-gradient(135deg,#100d0a,#382b15 58%,#17120c)", overlay: "rgba(16,13,10,.12)" },
    radius: 20, shadow: "0 20px 48px rgba(214,173,85,.14)", buttonStyle: "outline", sectionSpacing: 22, skin: "dimensional",
    stickers: [{ id: "template-royal", type: "emoji", value: "👑", x: 80, y: 10, size: 14, rotation: 4 }],
  },
  {
    id: "anime", name: "Anime", description: "Bold cobalt, hot pink accents and playful comic energy.",
    fonts: { heading: "'Trebuchet MS', sans-serif", body: "'Inter', sans-serif" },
    colors: { page: "#10091e", pageAlt: "#21143d", card: "rgba(30,18,53,.9)", cardAlt: "rgba(255,255,255,.08)", text: "#fff5ff", textMuted: "#d6b9e8", accent: "#f472b6", accentSoft: "rgba(244,114,182,.18)", border: "rgba(129,140,248,.26)", buttonText: "#170b20" },
    background: { type: "gradient", value: "linear-gradient(135deg,#111a4e,#371b63 52%,#6b174f)", overlay: "rgba(16,9,30,.12)" },
    radius: 24, shadow: "0 18px 42px rgba(129,140,248,.18)", buttonStyle: "filled", sectionSpacing: 22, skin: "tilt",
    stickers: [{ id: "template-anime", type: "emoji", value: "🌸", x: 81, y: 10, size: 15, rotation: 12 }],
  },
  {
    id: "nature-calm", name: "Nature / Calm", description: "Forest greens, mossy layers and grounded calm.",
    fonts: { heading: "'Georgia', serif", body: "'Inter', sans-serif" },
    colors: { page: "#091711", pageAlt: "#14291d", card: "rgba(20,41,29,.88)", cardAlt: "rgba(220,252,231,.07)", text: "#effaf0", textMuted: "#b3c9b5", accent: "#65a873", accentSoft: "rgba(101,168,115,.16)", border: "rgba(134,191,145,.2)", buttonText: "#07130b" },
    background: { type: "gradient", value: "linear-gradient(145deg,#091711,#244b31 60%,#13291c)", overlay: "rgba(9,23,17,.1)" },
    radius: 24, shadow: "0 16px 38px rgba(22,101,52,.18)", buttonStyle: "outline", sectionSpacing: 24, skin: "soft",
    stickers: [{ id: "template-nature", type: "emoji", value: "🍃", x: 82, y: 12, size: 14, rotation: -10 }],
  },
  {
    id: "retro-vaporwave", name: "Retro / Vaporwave", description: "Neon sunset gradients and nostalgic retro futurism.",
    fonts: { heading: "'Orbitron', sans-serif", body: "'Trebuchet MS', sans-serif" },
    colors: { page: "#10091e", pageAlt: "#27123b", card: "rgba(31,16,52,.86)", cardAlt: "rgba(255,255,255,.08)", text: "#fff2ff", textMuted: "#d8b8e4", accent: "#fb7185", accentSoft: "rgba(251,113,133,.18)", border: "rgba(192,132,252,.24)", buttonText: "#1a0a23" },
    background: { type: "gradient", value: "linear-gradient(135deg,#312e81,#a21caf 48%,#fb7185)", overlay: "rgba(16,9,30,.12)" },
    radius: 16, shadow: "0 0 34px rgba(192,132,252,.2)", buttonStyle: "filled", sectionSpacing: 20, skin: "glow",
    stickers: [{ id: "template-retro", type: "emoji", value: "🌴", x: 80, y: 10, size: 15, rotation: 5 }],
  },
  {
    id: "artist-creative", name: "Artist / Creative", description: "Expressive colors with a tactile, layered studio feel.",
    fonts: { heading: "'Playfair Display', serif", body: "'Trebuchet MS', sans-serif" },
    colors: { page: "#17101a", pageAlt: "#2a1828", card: "rgba(42,24,40,.84)", cardAlt: "rgba(255,255,255,.08)", text: "#fff7f2", textMuted: "#d7c0bd", accent: "#fb923c", accentSoft: "rgba(251,146,60,.16)", border: "rgba(251,146,60,.22)", buttonText: "#21120b" },
    background: { type: "gradient", value: "linear-gradient(135deg,#193746,#553056 52%,#9a4e39)", overlay: "rgba(23,16,26,.12)" },
    radius: 26, shadow: "0 18px 42px rgba(251,146,60,.16)", buttonStyle: "outline", sectionSpacing: 26, skin: "dimensional",
    stickers: [{ id: "template-artist", type: "emoji", value: "🎨", x: 80, y: 10, size: 15, rotation: -8 }],
  },
  {
    id: "musician", name: "Musician", description: "Midnight plum with a warm spotlight and stage-ready contrast.",
    fonts: { heading: "'Cormorant Garamond', serif", body: "'Inter', sans-serif" },
    colors: { page: "#100a16", pageAlt: "#241427", card: "rgba(36,20,39,.88)", cardAlt: "rgba(255,255,255,.07)", text: "#fff4fb", textMuted: "#cdb4c4", accent: "#d9467a", accentSoft: "rgba(217,70,122,.16)", border: "rgba(217,70,122,.22)", buttonText: "#ffffff" },
    background: { type: "gradient", value: "linear-gradient(140deg,#100a16,#45203a 62%,#21142b)", overlay: "rgba(16,10,22,.12)" },
    radius: 22, shadow: "0 18px 44px rgba(217,70,122,.16)", buttonStyle: "filled", sectionSpacing: 22, skin: "glass",
    stickers: [{ id: "template-musician", type: "emoji", value: "🎵", x: 82, y: 11, size: 14, rotation: 8 }],
  },
  {
    id: "funny-meme", name: "Funny / Meme", description: "Punchy acid-lime accents and playful, chunky shapes.",
    fonts: { heading: "'Arial Black', sans-serif", body: "'Trebuchet MS', sans-serif" },
    colors: { page: "#10130b", pageAlt: "#242b12", card: "rgba(36,43,18,.9)", cardAlt: "rgba(255,255,255,.08)", text: "#f8ffe9", textMuted: "#c6d39e", accent: "#c4f23b", accentSoft: "rgba(196,242,59,.16)", border: "rgba(196,242,59,.24)", buttonText: "#11150a" },
    background: { type: "gradient", value: "linear-gradient(135deg,#10130b,#38451b 58%,#252a12)", overlay: "rgba(16,19,11,.12)" },
    radius: 28, shadow: "0 14px 36px rgba(196,242,59,.15)", buttonStyle: "filled", sectionSpacing: 20, skin: "tilt",
    stickers: [{ id: "template-funny", type: "emoji", value: "😂", x: 81, y: 10, size: 15, rotation: 10 }],
  },
  {
    id: "romantic", name: "Romantic", description: "A soft rose glow with elegant, warm typography.",
    fonts: { heading: "'Playfair Display', serif", body: "'Georgia', serif" },
    colors: { page: "#1d1018", pageAlt: "#321b29", card: "rgba(50,27,41,.86)", cardAlt: "rgba(255,255,255,.08)", text: "#fff4f6", textMuted: "#dfbdc5", accent: "#e87992", accentSoft: "rgba(232,121,146,.17)", border: "rgba(251,182,206,.22)", buttonText: "#241017" },
    background: { type: "gradient", value: "linear-gradient(135deg,#321b29,#7c344e 58%,#3b2036)", overlay: "rgba(29,16,24,.12)" },
    radius: 30, shadow: "0 18px 42px rgba(232,121,146,.18)", buttonStyle: "filled", sectionSpacing: 24, skin: "soft",
    stickers: [{ id: "template-romantic", type: "emoji", value: "💗", x: 82, y: 10, size: 14, rotation: -8 }],
  },
  {
    id: "sporty-fitness", name: "Sporty / Fitness", description: "High-energy red and graphite for a powerful profile.",
    fonts: { heading: "'Arial Black', sans-serif", body: "'Inter', sans-serif" },
    colors: { page: "#101013", pageAlt: "#242428", card: "rgba(36,36,40,.92)", cardAlt: "rgba(255,255,255,.06)", text: "#fafafa", textMuted: "#b4b4bb", accent: "#f97363", accentSoft: "rgba(249,115,99,.16)", border: "rgba(249,115,99,.2)", buttonText: "#1b0c0a" },
    background: { type: "gradient", value: "linear-gradient(135deg,#101013,#3a1c1c 58%,#242428)", overlay: "rgba(16,16,19,.12)" },
    radius: 14, shadow: "0 18px 38px rgba(249,115,99,.16)", buttonStyle: "filled", sectionSpacing: 20, skin: "dimensional",
    stickers: [{ id: "template-sporty", type: "emoji", value: "🏆", x: 82, y: 10, size: 14, rotation: 5 }],
  },
  {
    id: "techie-hacker", name: "Techie / Hacker", description: "Terminal green, clean monospace and a subtle digital glow.",
    fonts: { heading: "'JetBrains Mono', monospace", body: "'JetBrains Mono', monospace" },
    colors: { page: "#060d0a", pageAlt: "#0d1c14", card: "rgba(13,28,20,.92)", cardAlt: "rgba(52,211,153,.08)", text: "#d8ffe9", textMuted: "#91c5a5", accent: "#34d399", accentSoft: "rgba(52,211,153,.14)", border: "rgba(52,211,153,.2)", buttonText: "#06120b" },
    background: { type: "pattern", value: "linear-gradient(rgba(52,211,153,.05) 1px, transparent 1px), linear-gradient(90deg,rgba(52,211,153,.05) 1px,transparent 1px), #060d0a", overlay: "rgba(6,13,10,.08)" },
    radius: 12, shadow: "0 0 28px rgba(52,211,153,.16)", buttonStyle: "outline", sectionSpacing: 18, skin: "glow",
    stickers: [{ id: "template-techie", type: "emoji", value: "⌘", x: 83, y: 11, size: 12, rotation: 0 }],
  },
];

const personalityTemplateCatalog = Object.fromEntries(
  personalityTemplateData.map((template) => [template.id, template]),
) as Record<(typeof PERSONALITY_TEMPLATE_IDS)[number], TemplateDefinition>;

export const templateCatalog: Record<TemplateId, TemplateDefinition> = {
  ...legacyTemplateCatalog,
  ...personalityTemplateCatalog,
};

export function createDefaultBlockConfig(type: ProfileBlock["type"]): Record<string, unknown> {
  switch (type) {
    case "about": return { title: "About" };
    case "links": return { title: "Links", links: [] };
    case "gallery": return { title: "Gallery", images: [] };
    case "quote": return { title: "Quote", body: "Write something worth remembering." };
    case "divider": case "spacer": return {};
    case "stats": return { title: "Stats" };
    case "posts": return { title: "Recent posts" };
    case "header": return {};
    default: return { title: "New section", body: "Write your text here." };
  }
}

export function createDefaultProfileBlocks(profileId: string): ProfileBlock[] {
  const defaults: Array<{ type: ProfileBlock["type"]; locked: boolean }> = [
    { type: "header", locked: true },
    { type: "stats", locked: true },
    { type: "about", locked: false },
    { type: "links", locked: false },
    { type: "gallery", locked: false },
  ];
  return defaults.map(({ type, locked }, position) => ({
    id: `draft-default-${position}`,
    profile_id: profileId,
    type,
    position,
    width: "full",
    config: createDefaultBlockConfig(type),
    style: {},
    visibility: "everyone",
    locked,
  }));
}

export const DEFAULT_TEMPLATE_ID: TemplateId = "aurora";

export const defaultBlockLayout = [
  { type: "header", width: "full", locked: true },
  { type: "stats", width: "full", locked: true },
  { type: "about", width: "full", locked: false },
  { type: "links", width: "half", locked: false },
  { type: "gallery", width: "half", locked: false },
  { type: "posts", width: "full", locked: true },
] as const;
