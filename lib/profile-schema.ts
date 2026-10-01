import { z } from "zod";

export const hexColorSchema = z.string().regex(/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Expected a hex color like #A1B2C3");
export const fontOptionSchema = z.string().min(1).default("Inter");
export const visibilitySchema = z.enum(["public", "followers", "private"]);
export const blockVisibilitySchema = z.enum(["everyone", "followers", "only_me"]);
export const layoutWidthSchema = z.enum(["full", "half"]);
export const templateIdSchema = z.enum([
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
]);

export const profileThemeSchema = z.object({
  page: hexColorSchema,
  pageAlt: hexColorSchema,
  card: z.string(),
  cardAlt: z.string(),
  text: hexColorSchema,
  textMuted: hexColorSchema,
  accent: hexColorSchema,
  accentSoft: z.string(),
  border: z.string(),
  buttonText: hexColorSchema,
  backgroundType: z.enum(["solid", "gradient", "pattern", "image"]).default("gradient"),
  backgroundValue: z.string().default("linear-gradient(135deg, #0f172a 0%, #1d4ed8 35%, #7c3aed 100%)"),
  radius: z.number().int().min(0).max(40).default(24),
  shadow: z.string().default("0 20px 60px rgba(96, 76, 175, 0.28)"),
  fontHeading: fontOptionSchema.default("Inter"),
  fontBody: fontOptionSchema.default("Inter"),
  buttonStyle: z.enum(["filled", "outline", "ghost"]).default("filled"),
  sectionSpacing: z.number().int().min(8).max(40).default(24),
});

export const profileBlockSchema = z.object({
  id: z.string().min(1),
  profile_id: z.string().uuid().optional(),
  type: z.enum([
    "header",
    "stats",
    "about",
    "links",
    "achievements",
    "struggles",
    "dreams",
    "likes",
    "gallery",
    "quote",
    "favorites",
    "timeline",
    "text",
    "divider",
    "spacer",
    "posts",
  ]),
  position: z.number().int().min(0).default(0),
  width: layoutWidthSchema.default("full"),
  config: z.record(z.string(), z.any()).default({}),
  style: z.record(z.string(), z.any()).default({}),
  visibility: blockVisibilitySchema.default("everyone"),
  locked: z.boolean().default(false),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const profileRecordSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(2).max(40).regex(/^[a-z0-9_\-.]+$/i, "Usernames may only contain letters, numbers, underscores, hyphen and dot."),
  name: z.string().max(80).default(""),
  bio: z.string().max(400).default(""),
  avatar_url: z.string().url().nullable().optional(),
  banner_url: z.string().url().nullable().optional(),
  template: templateIdSchema.default("aurora"),
  theme: profileThemeSchema.default({
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
    backgroundType: "gradient",
    backgroundValue: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 35%, #7c3aed 100%)",
    radius: 24,
    shadow: "0 20px 60px rgba(96, 76, 175, 0.28)",
    fontHeading: "Inter",
    fontBody: "Inter",
    buttonStyle: "filled",
    sectionSpacing: 24,
  }),
  visibility: visibilitySchema.default("public"),
  discoverable: z.boolean().default(true),
  verified: z.boolean().default(false).optional(),
  blocks: z.array(profileBlockSchema).default([]),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ProfileTheme = z.infer<typeof profileThemeSchema>;
export type ProfileBlock = z.infer<typeof profileBlockSchema>;
export type ProfileRecord = z.infer<typeof profileRecordSchema>;
