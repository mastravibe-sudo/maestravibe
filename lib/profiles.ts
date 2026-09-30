export type Item = {
  text: string;
  done?: boolean;
  status?: "self" | "proof" | "verified";
};
export type BlockKind = "text" | "list" | "checklist" | "achievements";
export type Block = {
  id: string;
  kind: BlockKind;
  icon: string;
  title: string;
  text?: string;
  items?: Item[];
};
export type Style = {
  bg1: string;
  bg2: string;
  card: string;
  cardAlpha: number;
  text: string;
  accent: string;
  font: "sans" | "serif" | "mono";
  radius: number;
};
export type Profile = {
  username: string;
  name: string;
  tagline: string;
  avatar: string;
  avatarSize: number;
  align: "center" | "left";
  style: Style;
  blocks: Block[];
};

export const fonts: Record<Style["font"], string> = {
  sans: "ui-sans-serif, system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, Menlo, Consolas, monospace",
};

export const presets: Record<string, Style> = {
  Dark: { bg1: "#09090b", bg2: "#1e1b4b", card: "#27272a", cardAlpha: 0.9, text: "#fafafa", accent: "#8b5cf6", font: "sans", radius: 20 },
  Sunset: { bg1: "#fb923c", bg2: "#a855f7", card: "#ffffff", cardAlpha: 0.2, text: "#ffffff", accent: "#fde047", font: "sans", radius: 24 },
  Minimal: { bg1: "#fafaf9", bg2: "#e7e5e4", card: "#ffffff", cardAlpha: 1, text: "#1c1917", accent: "#1c1917", font: "serif", radius: 12 },
  Ocean: { bg1: "#0ea5e9", bg2: "#1e3a8a", card: "#ffffff", cardAlpha: 0.15, text: "#ffffff", accent: "#22d3ee", font: "sans", radius: 20 },
};

export const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// accent colour ke upar text kaun sa colour ho (kala ya safed)
export const readable = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const y = (((n >> 16) & 255) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
  return y > 150 ? "#111111" : "#ffffff";
};

const b = (
  id: string,
  kind: BlockKind,
  icon: string,
  title: string,
  rest: Partial<Block> = {}
): Block => ({ id, kind, icon, title, ...rest });

export const profiles: Profile[] = [
  {
    username: "ali",
    name: "Ali Khan",
    tagline: "Builder. Dreamer. Still learning.",
    avatar: "🚀",
    avatarSize: 112,
    align: "center",
    style: presets.Dark,
    blocks: [
      b("a1", "text", "👋", "About Me", {
        text: "Main ek chota business shuru kar raha hoon aur coding seekh raha hoon. Mujhe naye idea banana pasand hai.",
      }),
      b("a2", "achievements", "🏆", "Achievements", {
        items: [
          { text: "Pehli online sale", status: "verified" },
          { text: "Web development course complete", status: "proof" },
          { text: "100 customers", status: "self" },
        ],
      }),
      b("a3", "list", "💪", "Current Struggles", {
        items: [
          { text: "Apni pehli car (paise jama kar raha hoon)" },
          { text: "Business scale karna (marketing seekh raha hoon)" },
        ],
      }),
      b("a4", "list", "❤️", "Pasand", {
        items: [{ text: "Chai" }, { text: "Raat ko coding" }, { text: "Cricket" }],
      }),
      b("a5", "checklist", "🌠", "My Dreams", {
        items: [
          { text: "Apna laptop", done: true },
          { text: "Apni company", done: false },
          { text: "Ghar", done: false },
          { text: "Duniya ghoomna", done: false },
        ],
      }),
    ],
  },
  {
    username: "sara",
    name: "Sara Ahmed",
    tagline: "Design, coffee, and good vibes",
    avatar: "🎨",
    avatarSize: 96,
    align: "center",
    style: presets.Sunset,
    blocks: [
      b("s1", "text", "✨", "Meri Kahani", {
        text: "Graphic designer hoon. Rang aur kahaniyan meri zindagi hain.",
      }),
      b("s2", "achievements", "🏆", "Wins", {
        items: [
          { text: "50 clients ke liye logo design", status: "proof" },
          { text: "Design award", status: "verified" },
        ],
      }),
      b("s3", "checklist", "🌠", "Khwab", {
        items: [
          { text: "Apna studio", done: false },
          { text: "Paris trip", done: true },
        ],
      }),
    ],
  },
  {
    username: "bilal",
    name: "Bilal Hussain",
    tagline: "Cloth business • 5 saal ka safar",
    avatar: "🧵",
    avatarSize: 100,
    align: "left",
    style: presets.Minimal,
    blocks: [
      b("b1", "text", "📖", "Mera Safar", {
        text: "Ek chhoti dukaan se shuru kiya tha. Ab online bhi bech raha hoon.",
      }),
      b("b2", "achievements", "🏆", "Milestones", {
        items: [
          { text: "5 saal complete", status: "proof" },
          { text: "300+ customers", status: "self" },
        ],
      }),
    ],
  },
  {
    username: "nova",
    name: "Nova Studio",
    tagline: "Creative agency • Ocean vibes",
    avatar: "🌊",
    avatarSize: 100,
    align: "center",
    style: presets.Ocean,
    blocks: [
      b("n1", "text", "🏢", "Hum Kaun Hain", {
        text: "Chhoti si team, bade idea. Brands ko unki asli vibe dikhate hain.",
      }),
      b("n2", "list", "🎯", "Hamari Services", {
        items: [{ text: "Branding" }, { text: "Websites" }, { text: "Social media" }],
      }),
    ],
  },
];