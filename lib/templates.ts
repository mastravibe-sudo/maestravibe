export const TEMPLATE_IDS = [
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
};

export const templateCatalog: Record<TemplateId, TemplateDefinition> = {
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

export const DEFAULT_TEMPLATE_ID: TemplateId = "aurora";

export const defaultBlockLayout = [
  { type: "header", width: "full", locked: true },
  { type: "stats", width: "full", locked: true },
  { type: "about", width: "full", locked: false },
  { type: "links", width: "half", locked: false },
  { type: "gallery", width: "half", locked: false },
  { type: "posts", width: "full", locked: true },
] as const;
