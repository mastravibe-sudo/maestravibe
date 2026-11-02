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
]);

export const profileStickerSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["emoji", "svg"]),
  value: z.string().min(1).max(2048),
  x: z.number().min(0).max(100).default(38),
  y: z.number().min(0).max(100).default(28),
  size: z.number().min(5).max(40).default(16),
  rotation: z.number().min(-180).max(180).default(0),
});

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
  skin: z.enum(["glass", "soft", "flat", "dimensional", "glow", "tilt"]).default("glass"),
  layout: z.enum(["canvas", "stacked", "showcase"]).default("canvas"),
  stickers: z.array(profileStickerSchema).max(30).default([]),
  buttonStyle: z.enum(["filled", "outline", "ghost"]).default("filled"),
  sectionSpacing: z.number().int().min(8).max(40).default(24),
});

export type ProfileTheme = z.infer<typeof profileThemeSchema>;

export const DEFAULT_PROFILE_THEME: ProfileTheme = profileThemeSchema.parse({
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
  skin: "glass",
  layout: "canvas",
  stickers: [],
  buttonStyle: "filled",
  sectionSpacing: 24,
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
  theme: profileThemeSchema.default(DEFAULT_PROFILE_THEME),
  visibility: visibilitySchema.default("public"),
  discoverable: z.boolean().default(true),
  verified: z.boolean().default(false).optional(),
  blocks: z.array(profileBlockSchema).default([]),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type ProfileSticker = z.infer<typeof profileStickerSchema>;
export type ProfileBlock = z.infer<typeof profileBlockSchema>;
export type ProfileRecord = z.infer<typeof profileRecordSchema>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function withFallback<T extends z.ZodType>(
  schema: T,
  value: unknown,
  fallback: z.output<T>,
): z.output<T> {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function normalizeProfileRecord(value: unknown): ProfileRecord {
  if (!isRecord(value)) return profileRecordSchema.parse(value);

  const rawTheme = isRecord(value.theme) ? value.theme : {};
  const stickers = Array.isArray(rawTheme.stickers)
    ? rawTheme.stickers.flatMap((sticker) => {
        const parsed = profileStickerSchema.safeParse(sticker);
        return parsed.success ? [parsed.data] : [];
      }).slice(0, 30)
    : DEFAULT_PROFILE_THEME.stickers;
  const theme: ProfileTheme = {
    page: withFallback(hexColorSchema, rawTheme.page, DEFAULT_PROFILE_THEME.page),
    pageAlt: withFallback(hexColorSchema, rawTheme.pageAlt, DEFAULT_PROFILE_THEME.pageAlt),
    card: withFallback(z.string(), rawTheme.card, DEFAULT_PROFILE_THEME.card),
    cardAlt: withFallback(z.string(), rawTheme.cardAlt, DEFAULT_PROFILE_THEME.cardAlt),
    text: withFallback(hexColorSchema, rawTheme.text, DEFAULT_PROFILE_THEME.text),
    textMuted: withFallback(hexColorSchema, rawTheme.textMuted, DEFAULT_PROFILE_THEME.textMuted),
    accent: withFallback(hexColorSchema, rawTheme.accent, DEFAULT_PROFILE_THEME.accent),
    accentSoft: withFallback(z.string(), rawTheme.accentSoft, DEFAULT_PROFILE_THEME.accentSoft),
    border: withFallback(z.string(), rawTheme.border, DEFAULT_PROFILE_THEME.border),
    buttonText: withFallback(hexColorSchema, rawTheme.buttonText, DEFAULT_PROFILE_THEME.buttonText),
    backgroundType: withFallback(profileThemeSchema.shape.backgroundType, rawTheme.backgroundType, DEFAULT_PROFILE_THEME.backgroundType),
    backgroundValue: withFallback(profileThemeSchema.shape.backgroundValue, rawTheme.backgroundValue, DEFAULT_PROFILE_THEME.backgroundValue),
    radius: withFallback(profileThemeSchema.shape.radius, rawTheme.radius, DEFAULT_PROFILE_THEME.radius),
    shadow: withFallback(profileThemeSchema.shape.shadow, rawTheme.shadow, DEFAULT_PROFILE_THEME.shadow),
    fontHeading: withFallback(profileThemeSchema.shape.fontHeading, rawTheme.fontHeading, DEFAULT_PROFILE_THEME.fontHeading),
    fontBody: withFallback(profileThemeSchema.shape.fontBody, rawTheme.fontBody, DEFAULT_PROFILE_THEME.fontBody),
    skin: withFallback(profileThemeSchema.shape.skin, rawTheme.skin, DEFAULT_PROFILE_THEME.skin),
    layout: withFallback(profileThemeSchema.shape.layout, rawTheme.layout, DEFAULT_PROFILE_THEME.layout),
    stickers,
    buttonStyle: withFallback(profileThemeSchema.shape.buttonStyle, rawTheme.buttonStyle, DEFAULT_PROFILE_THEME.buttonStyle),
    sectionSpacing: withFallback(profileThemeSchema.shape.sectionSpacing, rawTheme.sectionSpacing, DEFAULT_PROFILE_THEME.sectionSpacing),
  };
  const blocks = Array.isArray(value.blocks)
    ? value.blocks.map((block) => profileBlockSchema.parse(block))
    : [];

  return profileRecordSchema.parse({
    ...value,
    name: typeof value.name === "string" ? value.name : "",
    bio: typeof value.bio === "string" ? value.bio : "",
    avatar_url: withFallback(z.string().url().nullable().optional(), value.avatar_url, null),
    banner_url: withFallback(z.string().url().nullable().optional(), value.banner_url, null),
    template: withFallback(templateIdSchema, value.template, "aurora"),
    theme,
    visibility: withFallback(visibilitySchema, value.visibility, "public"),
    discoverable: typeof value.discoverable === "boolean" ? value.discoverable : true,
    verified: typeof value.verified === "boolean" ? value.verified : false,
    blocks,
  });
}
