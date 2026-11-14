"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ArrowLeft, ChevronDown, Eye, Layers, LayoutTemplate, Link2, Maximize2, Minimize2, Monitor, Palette, PanelTop,
  Smartphone, SlidersHorizontal, Sparkles, Sticker as StickerIcon, Tablet, Type, User, X, type LucideIcon,
} from "lucide-react";
import EmojiPicker, { Theme as EmojiTheme, type EmojiClickData } from "emoji-picker-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/components/CurrentUserContext";
import { generateAiSuggestions } from "@/lib/ai/generate";
import { normalizeProfileRecord, type ProfileBlock, type ProfileRecord, type ProfileSticker, type ProfileTheme } from "@/lib/profile-schema";
import { createDefaultBlockConfig, createDefaultProfileBlocks, templateCatalog, type TemplateId } from "@/lib/templates";
import ProfileRender, { getBlockGeometry, type BlockGeometry } from "@/components/ProfileRender";
import ProfileView from "@/components/ProfileView";
import { HeaderStylePicker } from "@/components/profile/HeaderStyles";
import { StatsStylePicker } from "@/components/profile/StatsStyles";
import { STICKERS } from "@/lib/stickers";
import ProfileWizard from "@/components/ProfileWizard";
import { Disclosure, SubTabs } from "@/components/studio/StudioPanel";

const MAX_IMAGE_BYTES = 100 * 1024;
const IMAGE_QUALITIES = [0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.28, 0.2];
type BlockType = ProfileBlock["type"];

type Category = "identity" | "design" | "background" | "header" | "sections" | "stickers" | "typography" | "links";
type Device = "desktop" | "tablet" | "mobile";

const CATEGORIES: ReadonlyArray<{ id: Category; label: string; short: string; description: string; Icon: LucideIcon }> = [
  { id: "identity", label: "Profile Identity", short: "Identity", description: "Your picture, name, bio and who can see your profile.", Icon: User },
  { id: "design", label: "Design & Templates", short: "Design", description: "Start from a template, then pick a surface finish.", Icon: LayoutTemplate },
  { id: "background", label: "Background & Colors", short: "Colors", description: "Page colors, accent and button styling.", Icon: Palette },
  { id: "header", label: "Header & Stats", short: "Header", description: "Banner, header style, statistics style and placement.", Icon: PanelTop },
  { id: "sections", label: "Sections", short: "Sections", description: "Arrange, add, edit and hide the sections of your profile.", Icon: Layers },
  { id: "stickers", label: "Stickers", short: "Stickers", description: "Place stickers and emoji on your profile.", Icon: StickerIcon },
  { id: "typography", label: "Typography", short: "Type", description: "Fonts, text size and alignment.", Icon: Type },
  { id: "links", label: "Links & Gallery", short: "Links", description: "Buttons, links and photo galleries.", Icon: Link2 },
];

const SUBS: Record<Category, ReadonlyArray<{ id: string; label: string }>> = {
  identity: [{ id: "profile", label: "Profile" }, { id: "bio", label: "Bio & privacy" }],
  design: [{ id: "templates", label: "Templates" }, { id: "surface", label: "Surface & depth" }],
  background: [{ id: "colors", label: "Colors" }, { id: "buttons", label: "Page & buttons" }],
  header: [{ id: "banner", label: "Banner" }, { id: "header", label: "Header style" }, { id: "stats", label: "Stats style" }],
  sections: [{ id: "arrange", label: "Arrangement" }, { id: "add", label: "Add" }, { id: "edit", label: "Edit sections" }],
  stickers: [{ id: "all", label: "Stickers" }],
  typography: [{ id: "fonts", label: "Fonts" }, { id: "text", label: "Section text" }],
  links: [{ id: "buttons", label: "Buttons" }, { id: "gallery", label: "Gallery" }],
};

const DEVICES = [
  { id: "desktop", label: "Desktop", Icon: Monitor, frame: "lg:max-w-[1040px]" },
  { id: "tablet", label: "Tablet", Icon: Tablet, frame: "lg:max-w-[768px]" },
  { id: "mobile", label: "Mobile", Icon: Smartphone, frame: "lg:max-w-[390px]" },
] as const;

const stickerCategories: Record<string, readonly string[]> = {
  All: STICKERS.map((sticker) => sticker.id),
  Vibes: ["star", "bolt", "flame", "wow", "sparkles", "moon", "planet", "rocket", "sun", "rainbow", "cloud", "music", "headphones", "mic", "camera", "vibe"],
  Love: ["heart", "hearteyes", "flower", "gift", "balloon", "cake"],
  Achievements: ["crown", "diamond", "check", "trophy", "medal", "gg", "hundred", "bulb"],
  Fun: ["smile", "cool", "sleepy", "ghost", "cat", "lol", "omg", "coffee", "icecream", "bell", "plane"],
};

async function compressImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Choose a valid JPG, PNG, or WebP image."));
      element.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");

    let scale = Math.min(1, 1600 / Math.max(image.width, image.height));
    let smallest: Blob | null = null;
    while (scale >= 0.1) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of IMAGE_QUALITIES) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (!blob) throw new Error("Your browser could not compress this image.");
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= MAX_IMAGE_BYTES) return blob;
      }
      scale *= 0.8;
    }
    throw new Error(`Could not compress below 100 KB. Smallest result: ${Math.ceil((smallest?.size ?? 0) / 1024)} KB.`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function compressBackgroundImage(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Choose a valid JPG, PNG, or WebP image."));
      element.src = objectUrl;
    });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Your browser could not prepare this image.");
    let scale = Math.min(1, 1920 / Math.max(image.width, image.height));
    while (scale >= 0.3) {
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.92, 0.86, 0.8, 0.72, 0.64, 0.56, 0.48]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (!blob) throw new Error("Your browser could not compress this image.");
        if (blob.size <= 950 * 1024) return blob;
      }
      scale *= 0.85;
    }
    throw new Error("This image is too detailed to fit under 1 MB. Try a smaller image.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readVideoSeconds(file: File) {
  return new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    window.setTimeout(() => done(null), 8000);
    video.preload = "metadata";
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}
function messageOf(error: unknown, fallback: string) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;
}

const subscribeNoop = () => () => undefined;
const snapshotOf = (...parts: unknown[]) => JSON.stringify(parts);

function RangeControl({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="flex justify-between text-xs text-zinc-400"><span>{label}</span><span>{Math.round(value)}</span></span>
      <input className="h-6 w-full accent-violet-400" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/70";
const fieldClass = `min-h-11 w-full rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-violet-400 ${FOCUS}`;
const smallLabel = "mb-1.5 block text-xs font-medium text-zinc-400";
const panelCard = "rounded-2xl border border-white/10 bg-white/[0.03] p-4";
const ghostButton = `inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40 motion-reduce:transition-none ${FOCUS}`;
const dangerButton = `inline-flex min-h-11 items-center justify-center rounded-xl border border-red-300/20 px-4 text-sm font-medium text-red-200 transition hover:bg-red-400/10 disabled:opacity-40 motion-reduce:transition-none ${FOCUS}`;
const choiceCard = (active: boolean) =>
  `rounded-2xl border p-3 text-left transition motion-reduce:transition-none ${FOCUS} ${active ? "border-violet-300 bg-violet-400/10 ring-2 ring-violet-400/40" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`;

export default function ProfileStudio({
  profile,
  stats = { followers: 0, following: 0 },
  onboarding = false,
}: {
  profile: ProfileRecord;
  stats?: { followers: number; following: number };
  onboarding?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { profile: currentUserProfile, setProfile: setCurrentUserProfile } = useCurrentUser();
  const [identity, setIdentity] = useState({
    name: profile.name ?? "",
    bio: profile.bio ?? "",
    avatar_url: profile.avatar_url ?? "",
    banner_url: profile.banner_url ?? "",
    visibility: profile.visibility ?? "public",
    template: (profile.template as TemplateId) ?? "aurora",
  });
  const [theme, setTheme] = useState<ProfileTheme>(() => ({
    ...profile.theme,
    skin: profile.theme.skin ?? "glass",
    layout: profile.theme.layout ?? "canvas",
    stickers: profile.theme.stickers ?? [],
  }));
  const [blocks, setBlocks] = useState<ProfileBlock[]>(() => profile.blocks.length ? profile.blocks : createDefaultProfileBlocks(profile.id));
  const [selectedId, setSelectedId] = useState<string | null>(() => blocks[0]?.id ?? null);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [stickerCategory, setStickerCategory] = useState("All");
  const [saving, setSaving] = useState(false);
  const [optimisticProfile, setOptimisticProfile] = useState<ProfileRecord | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "banner" | "gallery" | "background" | null>(null);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [category, setCategory] = useState<Category>("identity");
  const [device, setDevice] = useState<Device>("mobile");
  const [previewLarge, setPreviewLarge] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(onboarding);
  const [panelOpen, setPanelOpen] = useState(true);
  const [subTab, setSubTab] = useState<Partial<Record<Category, string>>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const pickSub = (cat: Category, id: string) => setSubTab((current) => ({ ...current, [cat]: id }));
  const selectCategory = (id: Category) => {
    if (id === category && panelOpen) {
      setPanelOpen(false);
      return;
    }
    setCategory(id);
    setPanelOpen(true);
  };
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);

  // Unsaved-changes tracking: compare against what was loaded.
  const [baseline] = useState(() => snapshotOf(identity, theme, blocks));
  const dirty = useMemo(() => snapshotOf(identity, theme, blocks) !== baseline, [identity, theme, blocks, baseline]);
  const workspaceActive = !optimisticProfile && !wizardOpen;

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;
  const headerBlock = blocks.find((block) => block.type === "header") ?? null;
  const statsBlock = blocks.find((block) => block.type === "stats") ?? null;
  const linkBlocks = blocks.filter((block) => block.type === "links");
  const galleryBlocks = blocks.filter((block) => block.type === "gallery");
  const previewProfile = normalizeProfileRecord({ ...profile, ...identity, theme, blocks });
  const currentCategory = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0];
  const deviceFrame = DEVICES.find((item) => item.id === device)?.frame ?? "lg:max-w-[390px]";
  const availableStickerCategories = Object.keys(stickerCategories).filter((name) =>
    name === "All" || STICKERS.some((sticker) => stickerCategories[name].includes(sticker.id)));

  // Lock page scroll only while the full-screen workspace is on screen.
  useEffect(() => {
    if (!workspaceActive) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [workspaceActive]);

  // Warn before the tab is closed or reloaded with unsaved work.
  useEffect(() => {
    if (!workspaceActive || !dirty || saving) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving, workspaceActive]);

  useEffect(() => {
    if (!previewOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen]);

  const generateBio = async () => {
    setGeneratingBio(true);
    setError(null);
    try {
      const suggestions = await generateAiSuggestions("bio", { name: identity.name, bio: identity.bio });
      setIdentity((current) => ({ ...current, bio: suggestions[0] }));
    } catch (generationError) {
      setError(messageOf(generationError, "Could not generate a bio."));
    } finally {
      setGeneratingBio(false);
    }
  };

  const updateBlock = (id: string, update: (block: ProfileBlock) => ProfileBlock) => {
    setBlocks((current) => current.map((block) => block.id === id ? update(block) : block));
  };

  const setConfig = (id: string, key: string, value: unknown) => {
    updateBlock(id, (block) => ({ ...block, config: { ...block.config, [key]: value } }));
  };

  const setBlockStyle = (id: string, key: string, value: unknown) => {
    updateBlock(id, (block) => ({ ...block, style: { ...block.style, [key]: value } }));
  };

  const setGeometry = (id: string, geometry: BlockGeometry) => {
    updateBlock(id, (block) => ({ ...block, style: { ...block.style, ...geometry } }));
  };

  const addSticker = (type: ProfileSticker["type"], value: string) => {
    const stickers = theme.stickers ?? [];
    if (stickers.length >= 30) {
      setError("A profile can have up to 30 stickers.");
      return;
    }
    const sticker: ProfileSticker = {
      id: crypto.randomUUID(),
      type,
      value,
      x: 38,
      y: 29,
      size: type === "emoji" ? 14 : 16,
      rotation: 0,
    };
    setTheme((current) => ({ ...current, stickers: [...(current.stickers ?? []), sticker] }));
    setSelectedStickerId(sticker.id);
  };

  const updateSticker = (id: string, update: Partial<ProfileSticker>) => {
    setTheme((current) => ({
      ...current,
      stickers: (current.stickers ?? []).map((sticker) => sticker.id === id ? { ...sticker, ...update } : sticker),
    }));
  };

  const removeSelectedSticker = () => {
    if (!selectedStickerId) return;
    setTheme((current) => ({ ...current, stickers: (current.stickers ?? []).filter((sticker) => sticker.id !== selectedStickerId) }));
    setSelectedStickerId(null);
  };

  // Tapping a section on the canvas selects it and opens the matching editor.
  const selectCanvasBlock = (id: string) => {
    setSelectedId(id);
    setPanelOpen(true);
    if (category === "typography") return;
    const block = blocks.find((item) => item.id === id);
    if (block?.type === "header" || block?.type === "stats") {
      setCategory("header");
      pickSub("header", block.type === "stats" ? "stats" : "header");
    } else if (block?.type === "links" || block?.type === "gallery") {
      setCategory("links");
      pickSub("links", block.type === "gallery" ? "gallery" : "buttons");
    } else {
      setCategory("sections");
      pickSub("sections", "edit");
    }
  };

  const applyLayout = (layout: ProfileTheme["layout"]) => {
    setTheme((current) => ({ ...current, layout }));
    if (layout === "canvas") return;

    const positions: Record<string, BlockGeometry> = layout === "stacked"
      ? {
          header: { x: 5, y: 4, width: 90, height: 16 },
          stats: { x: 5, y: 22, width: 90, height: 10 },
          about: { x: 5, y: 35, width: 90, height: 15 },
          links: { x: 5, y: 53, width: 90, height: 14 },
          gallery: { x: 5, y: 69, width: 90, height: 18 },
          posts: { x: 5, y: 89, width: 90, height: 10 },
        }
      : {
          header: { x: 5, y: 4, width: 90, height: 16 },
          stats: { x: 5, y: 22, width: 90, height: 10 },
          gallery: { x: 5, y: 35, width: 90, height: 28 },
          about: { x: 5, y: 66, width: 55, height: 18 },
          links: { x: 63, y: 66, width: 32, height: 18 },
          posts: { x: 5, y: 87, width: 90, height: 11 },
        };
    setBlocks((current) => current.map((block) => {
      const geometry = positions[block.type];
      return geometry ? { ...block, style: { ...block.style, ...geometry } } : block;
    }));
  };

  const addBlock = (type: BlockType) => {
    const block: ProfileBlock = {
      id: `draft-${crypto.randomUUID()}`,
      profile_id: profile.id,
      type,
      position: blocks.length,
      width: "full",
      config: createDefaultBlockConfig(type),
      style: {},
      visibility: "everyone",
      locked: false,
    };
    setBlocks((current) => [...current, block]);
    setSelectedId(block.id);
  };

  const removeBlock = (target: ProfileBlock) => {
    if (target.locked) {
      setError("This section belongs to every profile. You can move, resize and restyle it, but not remove it.");
      return;
    }
    setBlocks((current) => current.filter((block) => block.id !== target.id));
    if (selectedId === target.id) {
      const next = blocks.find((block) => block.id !== target.id);
      setSelectedId(next?.id ?? null);
    }
  };

  const removeSelected = () => {
    if (selectedBlock) removeBlock(selectedBlock);
  };

  const applyTemplate = (templateId: TemplateId) => {
    const preset = templateCatalog[templateId];
    setIdentity((current) => ({ ...current, template: templateId }));
    setTheme((current) => ({
      ...current,
      page: preset.colors.page,
      pageAlt: preset.colors.pageAlt,
      card: preset.colors.card,
      cardAlt: preset.colors.cardAlt,
      text: preset.colors.text,
      textMuted: preset.colors.textMuted,
      accent: preset.colors.accent,
      accentSoft: preset.colors.accentSoft,
      border: preset.colors.border,
      buttonText: preset.colors.buttonText,
      backgroundType: preset.background.type,
      backgroundValue: preset.background.value,
      radius: preset.radius,
      shadow: preset.shadow,
      fontHeading: preset.fonts.heading,
      fontBody: preset.fonts.body,
      buttonStyle: preset.buttonStyle,
      sectionSpacing: preset.sectionSpacing,
      skin: preset.skin ?? current.skin,
      stickers: preset.stickers?.map((sticker) => ({ ...sticker, id: crypto.randomUUID() })) ?? current.stickers,
    }));
  };

  const uploadImage = async (imageType: "avatar" | "banner", file: File) => {
    setUploading(imageType);
    setError(null);
    setSuccess(null);
    try {
      const image = await compressImage(file);
      const formData = new FormData();
      formData.append("purpose", "profile");
      formData.append("imageType", imageType);
      formData.append("file", image, `${imageType}.webp`);
      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json() as { publicUrl?: string; error?: string };
      if (!response.ok || !result.publicUrl) throw new Error(result.error || "Image upload failed.");
      setIdentity((current) => ({ ...current, [imageType === "avatar" ? "avatar_url" : "banner_url"]: result.publicUrl! }));
      setSuccess(`${imageType === "avatar" ? "Avatar" : "Banner"} ready (${Math.ceil(image.size / 1024)} KB). Save to publish it.`);
    } catch (uploadError) {
      setError(messageOf(uploadError, "Image upload failed."));
    } finally {
      setUploading(null);
    }
  };

  const uploadBackground = async (file: File) => {
    const isVideo = file.type === "video/mp4" || file.type === "video/webm";

    if (!isVideo && !file.type.startsWith("image/")) {
      setError("Please select an image, MP4, or WebM video.");
      return;
    }

    if (isVideo && file.size > 4 * 1024 * 1024) {
      setError("Background video must be 4 MB or smaller.");
      return;
    }

    if (isVideo) {
      const seconds = await readVideoSeconds(file);
      if (seconds === null) {
        setError("This video could not be read. Use an MP4 or WebM file your browser can play.");
        return;
      }
      if (seconds > 15.5) {
        setError("Background video must be 15 seconds or shorter.");
        return;
      }
    }

    setUploading("background");
    setError(null);
    setSuccess(null);

    try {
      const uploadFile = isVideo ? file : await compressBackgroundImage(file);
      const formData = new FormData();
      formData.append("purpose", isVideo ? "profile-background-video" : "profile-background-image");
      formData.append("file", uploadFile, isVideo ? file.name : "background.webp");

      const response = await fetch("/api/upload", { method: "POST", body: formData });
      const result = await response.json() as { publicUrl?: string; error?: string };

      if (!response.ok || !result.publicUrl) {
        throw new Error(result.error || "Background upload failed.");
      }

      setTheme((current) => ({
        ...current,
        backgroundType: "image",
        backgroundValue: result.publicUrl!,
        backgroundMediaType: isVideo ? "video" : "image",
      }));

      setSuccess("Background uploaded. Save to publish it.");
    } catch (uploadError) {
      setError(messageOf(uploadError, "Background upload failed."));
    } finally {
      setUploading(null);
    }
  };
  const uploadGallery = async (blockId: string, files: File[]) => {
    const current = ((blocks.find((item) => item.id === blockId)?.config.images as string[]) ?? []).slice();
    setUploading("gallery");
    setError(null);
    setSuccess(null);
    try {
      for (const file of files.slice(0, Math.max(0, 12 - current.length))) {
        const image = await compressImage(file);
        const formData = new FormData();
        formData.append("purpose", "profile");
        formData.append("imageType", "gallery");
        formData.append("file", image, "gallery.webp");
        const response = await fetch("/api/upload", { method: "POST", body: formData });
        const result = await response.json() as { publicUrl?: string; error?: string };
        if (!response.ok || !result.publicUrl) throw new Error(result.error || "Image upload failed.");
        current.push(result.publicUrl);
        setConfig(blockId, "images", [...current]);
      }
      setSuccess("Photos added. Save to publish them.");
    } catch (uploadError) {
      setError(messageOf(uploadError, "Image upload failed."));
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (saving || uploading !== null) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const savedAt = new Date().toISOString();
    const activeIds = new Set(blocks.map((block) => block.id));
    const deletedIds = profile.blocks.filter((block) => !block.locked && !activeIds.has(block.id)).map((block) => block.id);
    const optimisticBlocks = blocks.map((block, position) => {
      const geometry = getBlockGeometry(block, position);
      return {
        ...block,
        position,
        profile_id: profile.id,
        style: block.locked ? { ...block.style, ...geometry, hidden: false } : { ...block.style, ...geometry },
      };
    });
    const previousCurrentProfile = currentUserProfile;
    setCurrentUserProfile((current) => current ? {
      ...current,
      name: identity.name.trim(),
      bio: identity.bio.trim(),
      avatar_url: identity.avatar_url.trim() || null,
    } : current);
    setOptimisticProfile({
      ...profile,
      ...identity,
      name: identity.name.trim(),
      bio: identity.bio.trim(),
      avatar_url: identity.avatar_url.trim() || null,
      banner_url: identity.banner_url.trim() || null,
      theme,
      updated_at: savedAt,
      blocks: optimisticBlocks,
    });
    setSuccess("Saving your profile…");
    try {
      const { data: { user }, error: sessionError } = await supabase.auth.getUser();
      if (sessionError) throw new Error(`Session check: ${sessionError.message}`);
      if (!user || user.id !== profile.id) {
        throw new Error("Your browser session does not own this profile. Log out, log back in, and retry.");
      }

      const profileWrite = async () => {
        const { data: savedProfile, error: profileError } = await supabase
          .from("profiles")
          .update({
            name: identity.name.trim(),
            bio: identity.bio.trim(),
            avatar_url: identity.avatar_url.trim() || null,
            banner_url: identity.banner_url.trim() || null,
            visibility: identity.visibility,
            template: identity.template,
            theme,
            updated_at: savedAt,
            ...(onboarding ? { onboarding_completed_at: savedAt } : {}),
          })
          .eq("id", profile.id)
          .select("id")
          .maybeSingle();
        if (profileError) throw new Error(`Profile details: ${profileError.message}`);
        if (!savedProfile) throw new Error("No profile row was updated. Log in again and retry.");
      };

      const blockWrites = blocks.map(async (block, position) => {
        const geometry = getBlockGeometry(block, position);
        const values = {
          position,
          width: block.width,
          config: block.config,
          style: block.locked ? { ...block.style, ...geometry, hidden: false } : { ...block.style, ...geometry },
          visibility: block.visibility,
        };

        if (block.id.startsWith("draft-")) {
          const { data, error: insertError } = await supabase
            .from("profile_blocks")
            .insert({ profile_id: profile.id, type: block.type, ...values })
            .select("id")
            .single();
          if (insertError) throw new Error(`New section: ${insertError.message}`);
          setBlocks((current) => current.map((item) => item.id === block.id ? { ...item, id: data.id, profile_id: profile.id } : item));
          if (selectedId === block.id) setSelectedId(data.id);
        } else {
          const { data, error: updateError } = await supabase
            .from("profile_blocks")
            .update(values)
            .eq("id", block.id)
            .eq("profile_id", profile.id)
            .select("id")
            .maybeSingle();
          if (updateError) throw new Error(`Section update: ${updateError.message}`);
          if (!data) throw new Error("A section was not updated. Run the visual-builder SQL migration and retry.");
        }
      });

      const deleteWrite = async () => {
        if (!deletedIds.length) return;
        const { error: deleteError } = await supabase
          .from("profile_blocks")
          .delete()
          .in("id", deletedIds)
          .eq("profile_id", profile.id);
        if (deleteError) throw new Error(`Removed sections: ${deleteError.message}`);
      };

      const writes = await Promise.allSettled([profileWrite(), Promise.all(blockWrites), deleteWrite()]);
      const failedWrite = writes.find((write) => write.status === "rejected");
      if (failedWrite?.status === "rejected") throw failedWrite.reason;
      setSuccess("Your profile layout is saved.");
      router.replace(`/${profile.username}`);
      router.refresh();
    } catch (saveError) {
      setCurrentUserProfile(previousCurrentProfile);
      setOptimisticProfile(null);
      setSuccess(null);
      setError(messageOf(saveError, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  };

  const skipOnboarding = async () => {
    setSaving(true);
    setError(null);
    const { error: flagError } = await supabase
      .from("profiles")
      .update({ onboarding_completed_at: new Date().toISOString() })
      .eq("id", profile.id);
    setSaving(false);
    if (flagError) {
      setError(messageOf(flagError, "Could not skip setup."));
      return;
    }
    router.replace(`/${profile.username}`);
    router.refresh();
  };

  const requestClose = () => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return;
    router.push(`/${profile.username}`);
  };

  const uploadControl = (kind: "avatar" | "banner", label?: string) => (
    <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5 focus-within:ring-2 focus-within:ring-violet-300/70 motion-reduce:transition-none ${uploading !== null ? "opacity-60" : ""}`}>
      {uploading === kind ? "Preparing..." : label ?? `Upload ${kind}`}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={uploading !== null}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void uploadImage(kind, file);
        }}
      />
    </label>
  );

  const themeColor = (key: "page" | "accent" | "text" | "buttonText", label: string) => (
    <label key={key} className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-200">
      <span>{label}</span>
      <input aria-label={label} type="color" value={theme[key]} onChange={(event) => setTheme((current) => ({ ...current, [key]: event.target.value }))} className="h-11 w-14 cursor-pointer rounded-xl border-0 bg-transparent p-0" />
    </label>
  );

  // ---- reusable editors ------------------------------------------------------
  const bioEditor = () => (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor="profile-bio" className="text-xs font-medium text-zinc-400">Bio</label>
        <button type="button" onClick={() => void generateBio()} disabled={generatingBio} className={`inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 text-xs font-semibold text-violet-200 hover:bg-violet-400/20 disabled:opacity-50 ${FOCUS}`}>
          <Sparkles className="h-4 w-4" />{generatingBio ? "Generating..." : "Generate bio"}
        </button>
      </div>
      <textarea id="profile-bio" rows={5} maxLength={400} value={identity.bio} onChange={(event) => setIdentity((current) => ({ ...current, bio: event.target.value }))} className={`${fieldClass} resize-y`} />
      <p className="mt-1 text-right text-[11px] text-zinc-500">{identity.bio.length}/400</p>
    </div>
  );

  const sectionChips = () => (
    <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
      {blocks.map((block) => (
        <button key={block.id} type="button" onClick={() => setSelectedId(block.id)} aria-pressed={selectedId === block.id} className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm capitalize ${FOCUS} ${selectedId === block.id ? "border-violet-300 bg-violet-400/15 text-white" : "border-white/10 text-zinc-300 hover:bg-white/5"}`}>
          {block.type}{block.style.hidden === true ? " (hidden)" : ""}
        </button>
      ))}
    </div>
  );

  const positionControls = (block: ProfileBlock) => {
    const geometry = getBlockGeometry(block, blocks.indexOf(block));
    return (
      <div className="space-y-3">
        <p className={smallLabel}>Position and size</p>
        {(["x", "y", "width", "height"] as const).map((key) => {
          const limits = key === "x" || key === "y" ? [0, 95] : [5, 100];
          return <RangeControl key={key} label={key === "x" ? "Horizontal" : key === "y" ? "Vertical" : key === "width" ? "Width" : "Height"} value={geometry[key]} min={limits[0]} max={limits[1]} onChange={(value) => setGeometry(block.id, { ...geometry, [key]: value })} />;
        })}
        <p className="pt-1 text-[11px] text-zinc-500">You can also drag the section handle or resize its lower-right corner on the preview.</p>
      </div>
    );
  };

  const blockToggles = (block: ProfileBlock) => (
    <div className="space-y-3">
      <label className="block"><span className={smallLabel}>Section visibility</span><select value={block.visibility} onChange={(event) => updateBlock(block.id, (item) => ({ ...item, visibility: event.target.value as ProfileBlock["visibility"] }))} className={fieldClass}><option value="everyone">Everyone</option><option value="followers">Followers</option><option value="only_me">Only me</option></select></label>
      <button type="button" onClick={() => { if (!block.locked) setBlockStyle(block.id, "hidden", block.style.hidden !== true); }} disabled={block.locked} className={`${ghostButton} w-full`}>{block.style.hidden === true ? "Show section" : "Hide section"}</button>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-zinc-300">
        <span>Text only (no card)</span>
        <input type="checkbox" checked={block.style.textOnly === true} onChange={(event) => setBlockStyle(block.id, "textOnly", event.target.checked)} className="h-5 w-5 accent-violet-400" />
      </label>
    </div>
  );

  const appearanceControls = (block: ProfileBlock) => (
    <div className="space-y-3">
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-zinc-300"><span>Background</span><input aria-label="Section background" type="color" value={String(block.style.backgroundColor ?? "#22212a")} onChange={(event) => setBlockStyle(block.id, "backgroundColor", event.target.value)} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-zinc-300"><span>Text color</span><input aria-label="Section text color" type="color" value={String(block.style.textColor ?? theme.text)} onChange={(event) => setBlockStyle(block.id, "textColor", event.target.value)} className="h-9 w-12 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
      <label className="block"><span className={smallLabel}>Font</span><select value={String(block.style.fontFamily ?? theme.fontBody)} onChange={(event) => setBlockStyle(block.id, "fontFamily", event.target.value)} className={fieldClass}><option value="Georgia, serif">Georgia</option><option value="Inter">Inter</option><option value="Arial, sans-serif">Arial</option><option value="Trebuchet MS, sans-serif">Trebuchet</option><option value="monospace">Monospace</option></select></label>
      <label className="block"><span className={smallLabel}>Text alignment</span><select value={String(block.style.textAlign ?? "left")} onChange={(event) => setBlockStyle(block.id, "textAlign", event.target.value)} className={fieldClass}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
      <RangeControl label="Text size" value={Number(block.style.fontSize ?? 16)} min={10} max={40} onChange={(value) => setBlockStyle(block.id, "fontSize", value)} />
      <RangeControl label="Corner roundness" value={Number(block.style.borderRadius ?? 18)} min={0} max={48} onChange={(value) => setBlockStyle(block.id, "borderRadius", value)} />
      {block.type === "links" ? <label className="block"><span className={smallLabel}>Button appearance</span><select value={String(block.style.buttonStyle ?? theme.buttonStyle)} onChange={(event) => setBlockStyle(block.id, "buttonStyle", event.target.value)} className={fieldClass}><option value="filled">Filled</option><option value="outline">Outline</option><option value="ghost">Ghost</option></select></label> : null}
    </div>
  );

  const titleField = (block: ProfileBlock) => (
    <label className="block"><span className={smallLabel}>Section title</span><input value={String(block.config.title ?? "")} onChange={(event) => setConfig(block.id, "title", event.target.value)} className={fieldClass} /></label>
  );

  const linksEditor = (block: ProfileBlock) => {
    const links = (block.config.links as Array<{ text?: string; href?: string }>) ?? [];
    return (
      <div className="space-y-2">
        <p className={smallLabel}>Buttons and links</p>
        {links.map((link, index, all) => (
          <div key={`${index}-${link.href}`} className="rounded-xl border border-white/10 p-2">
            <input aria-label="Button label" placeholder="Button label" value={link.text ?? ""} onChange={(event) => setConfig(block.id, "links", all.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} className={`${fieldClass} mb-2`} />
            <div className="flex gap-2">
              <input aria-label="Button URL" placeholder="https://..." value={link.href ?? ""} onChange={(event) => setConfig(block.id, "links", all.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item))} className={`${fieldClass} min-w-0`} />
              <button type="button" aria-label="Remove link" onClick={() => setConfig(block.id, "links", all.filter((_item, itemIndex) => itemIndex !== index))} className={`flex min-h-11 min-w-11 items-center justify-center rounded-xl text-red-300 hover:bg-red-400/10 ${FOCUS}`}><X className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setConfig(block.id, "links", [...links, { text: "New button", href: "https://" }])} className="min-h-11 w-full rounded-xl border border-dashed border-white/15 px-3 text-sm text-zinc-300 hover:border-violet-300/50">+ Add button</button>
      </div>
    );
  };

  const galleryEditor = (block: ProfileBlock) => {
    const photos = (block.config.images as string[]) ?? [];
    return (
      <div>
        <p className={smallLabel}>Photos ({photos.length}/12)</p>
        <div className="mb-2 grid grid-cols-4 gap-2">
          {photos.map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              <button type="button" aria-label="Remove photo" onClick={() => setConfig(block.id, "images", photos.filter((_item, itemIndex) => itemIndex !== index))} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        <label className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-white/10 px-4 text-sm text-zinc-200 hover:bg-white/5 focus-within:ring-2 focus-within:ring-violet-300/70 ${uploading !== null || photos.length >= 12 ? "opacity-60" : ""}`}>
          {uploading === "gallery" ? "Uploading..." : photos.length >= 12 ? "Gallery is full" : "Add photos"}
          <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading !== null || photos.length >= 12} onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) void uploadGallery(block.id, files); }} />
        </label>
      </div>
    );
  };

  const addSectionButtons = (types: Array<[BlockType, string]>) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {types.map(([type, label]) => <button key={type} type="button" onClick={() => addBlock(type)} className={`${ghostButton} text-zinc-200`}>+ {label}</button>)}
    </div>
  );

  // ---- category panels -------------------------------------------------------
  const sub = subTab[category] ?? SUBS[category][0].id;
  const is = (id: string) => sub === id;
  const showAdvanced = category === "header" || category === "sections" || category === "typography" || category === "links";
  const positionTarget = category === "header"
    ? (selectedBlock && (selectedBlock.type === "header" || selectedBlock.type === "stats") ? selectedBlock : headerBlock)
    : selectedBlock;

  const renderPanel = () => {
    switch (category) {
      case "identity":
        return (
          <>
            {is("profile") ? (
<>
<div className={panelCard}>
              <p className={smallLabel}>Profile picture</p>
              <div className="flex items-center gap-4">
                <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-violet-300/30 bg-gradient-to-br from-violet-600 to-fuchsia-500 text-2xl font-bold text-white">
                  {identity.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={identity.avatar_url} alt="Your profile picture" className="h-full w-full object-cover" />
                  ) : (identity.name || profile.username).slice(0, 1).toUpperCase()}
                </span>
                <div className="flex flex-wrap gap-2">
                  {uploadControl("avatar", identity.avatar_url ? "Replace picture" : "Upload picture")}
                  {identity.avatar_url ? <button type="button" onClick={() => setIdentity((current) => ({ ...current, avatar_url: "" }))} className={dangerButton}>Remove</button> : null}
                </div>
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">Images are converted to WebP and kept under 100 KB. Save to publish.</p>
            </div>
            <div className={`${panelCard} space-y-3`}>
              <label className="block"><span className={smallLabel}>Display name</span><input value={identity.name} maxLength={60} onChange={(event) => setIdentity((current) => ({ ...current, name: event.target.value }))} className={fieldClass} /></label>
              <div><span className={smallLabel}>Username</span><p className="min-h-11 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-zinc-400">@{profile.username}</p></div>
            </div>
</>
) : null}
{is("bio") ? (
<>
<div className={panelCard}>{bioEditor()}</div>
            <div className={panelCard}>
              <label className="block"><span className={smallLabel}>Profile visibility</span><select value={identity.visibility} onChange={(event) => setIdentity((current) => ({ ...current, visibility: event.target.value as typeof current.visibility }))} className={fieldClass}><option value="public">Public</option><option value="followers">Followers</option><option value="private">Private</option></select></label>
            </div>
</>
) : null}
</>
        );

      case "design":
        return (
          <>
            {is("templates") ? (
<>
<div className={panelCard}>
              <h3 className="text-sm font-semibold">Templates</h3>
              <p className="mb-3 mt-1 text-xs text-zinc-400">Pick a starting look. Colors, fonts, surfaces, background and starter stickers update together.</p>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(templateCatalog).map((template, index) => {
                  const threeDimensional = index % 3 !== 1;
                  return (
                    <button key={template.id} type="button" onClick={() => applyTemplate(template.id)} aria-pressed={identity.template === template.id} className={`${choiceCard(identity.template === template.id)} p-2`}>
                      <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl" style={{ background: template.background.value }}>
                        <div className={`w-[78%] rounded-2xl border p-2.5 shadow-xl ${threeDimensional ? "[transform:perspective(520px)_rotateY(-9deg)_rotateX(5deg)]" : ""}`} style={{ background: template.colors.card, borderColor: template.colors.border, color: template.colors.text, boxShadow: template.shadow, borderRadius: `${template.radius}px`, fontFamily: template.fonts.body }}>
                          <div className="mb-2 flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full text-xs" style={{ background: template.colors.accent, color: template.colors.buttonText }}>{(identity.name || profile.username).slice(0, 1).toUpperCase()}</span><span className="truncate text-[11px] font-semibold" style={{ fontFamily: template.fonts.heading }}>{identity.name || `@${profile.username}`}</span></div>
                          <div className="mb-1.5 h-1.5 w-3/4 rounded-full" style={{ background: template.colors.accent }} />
                          <div className="grid grid-cols-2 gap-1.5"><span className="h-5 rounded-md" style={{ background: template.colors.cardAlt }} /><span className="h-5 rounded-md" style={{ background: template.colors.cardAlt }} /></div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-1 pt-2"><span className="truncate text-sm font-semibold">{template.name}</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">{threeDimensional ? "3D" : "2D"}</span></div>
                      <p className="px-1 pb-1 text-[11px] leading-snug text-zinc-400">{template.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
</>
) : null}
{is("surface") ? (
<>
<div className={panelCard}>
              <h3 className="text-sm font-semibold">Surface and depth</h3>
              <p className="mb-3 mt-1 text-xs text-zinc-400">Choose a finish for your profile sections.</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { id: "glass", title: "Glass", detail: "Blur and luminous edges", effect: "bg-white/15 backdrop-blur-xl border border-white/40" },
                  { id: "soft", title: "Soft", detail: "Warm layered surfaces", effect: "border border-white/20 shadow-lg" },
                  { id: "flat", title: "Flat", detail: "Minimal, transparent cards", effect: "border border-white/40" },
                  { id: "dimensional", title: "Dimension", detail: "Depth and 3D highlights", effect: "border border-white/40 shadow-2xl [transform:perspective(500px)_rotateY(-10deg)_rotateX(5deg)]" },
                  { id: "glow", title: "Glow", detail: "Luminous accent edges", effect: "border border-violet-300/50 shadow-[0_0_28px_rgba(168,85,247,.35)]" },
                  { id: "tilt", title: "Tilt", detail: "Playful angled surfaces", effect: "border border-white/30 shadow-xl [transform:perspective(500px)_rotateY(-9deg)_rotateX(5deg)]" },
                ] as const).map((skin) => (
                  <button key={skin.id} type="button" onClick={() => setTheme((current) => ({ ...current, skin: skin.id }))} aria-pressed={(theme.skin ?? "glass") === skin.id} className={choiceCard((theme.skin ?? "glass") === skin.id)}>
                    <div className="flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 via-zinc-800 to-fuchsia-500/20"><div className={`w-3/4 rounded-2xl p-3 ${skin.effect}`} style={{ backgroundColor: skin.id === "soft" ? theme.cardAlt : skin.id === "flat" ? "transparent" : undefined }}><div className="mb-2 h-2 w-3/4 rounded-full bg-white/80" /><div className="h-2 w-1/2 rounded-full bg-white/35" /><div className="mt-3 h-5 rounded-lg bg-white/20" /></div></div>
                    <span className="mt-2 block text-sm font-semibold">{skin.title}</span><span className="mt-0.5 block text-[11px] text-zinc-400">{skin.detail}</span>
                  </button>
                ))}
              </div>
            </div>
</>
) : null}
</>
        );

      case "background":
        return (
          <>
            {is("colors") ? (
<>
<div className={`${panelCard} space-y-2`}>
              <h3 className="mb-1 text-sm font-semibold">Color palette</h3>
              {themeColor("page", "Page color")}
              {themeColor("accent", "Accent color")}
              {themeColor("text", "Text color")}
              {themeColor("buttonText", "Button text")}
            </div>
</>
) : null}
{is("buttons") ? (
<>
<div className={`${panelCard} space-y-3`}>
              <label className="block">
                <span className={smallLabel}>Page background</span>
                <select value={theme.backgroundType} onChange={(event) => setTheme((current) => ({ ...current, backgroundType: event.target.value as ProfileTheme["backgroundType"] }))} className={fieldClass}>
                  <option value="solid">Solid color</option><option value="gradient">Template background</option>
                <option value="image">Uploaded image / video</option>
                </select>
              </label>

              <div className="space-y-3">
                <label className="block">
                  <span className={smallLabel}>Background image or video</span>
                  <input
                    type="file"
                    accept="image/*,video/mp4,video/webm"
                    disabled={uploading === "background"}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadBackground(file);
                      event.currentTarget.value = "";
                    }}
                    className={fieldClass}
                  />
                </label>

                {uploading === "background" ? (
                  <p className="text-sm opacity-70">Uploading background...</p>
                ) : null}

                {theme.backgroundType === "image" && theme.backgroundValue ? (
                  <div className="overflow-hidden rounded-xl border">
                    {theme.backgroundMediaType === "video" ? (
                      <video src={theme.backgroundValue} className="w-full max-h-56 object-cover" controls muted loop playsInline />
                    ) : (
                      <img src={theme.backgroundValue} alt="Profile background preview" className="w-full max-h-56 object-cover" />
                    )}
                  </div>
                ) : null}
              </div>

              <label className="block">
                <span className={smallLabel}>Button style</span>
                <select value={theme.buttonStyle} onChange={(event) => setTheme((current) => ({ ...current, buttonStyle: event.target.value as ProfileTheme["buttonStyle"] }))} className={fieldClass}>
                  <option value="filled">Filled</option><option value="outline">Outline</option><option value="ghost">Ghost</option>
                </select>
              </label>
            </div>
</>
) : null}
</>
        );

      case "header":
        return (
          <>
            {is("banner") ? (
<>
<div className={panelCard}>
              <p className={smallLabel}>Banner</p>
              <div className="mb-3 h-24 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-r from-violet-900/50 to-fuchsia-900/30">
                {identity.banner_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={identity.banner_url} alt="Your banner" className="h-full w-full object-cover" />
                ) : <span className="flex h-full items-center justify-center text-xs text-zinc-500">No banner yet</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {uploadControl("banner", identity.banner_url ? "Replace banner" : "Upload banner")}
                {identity.banner_url ? <button type="button" onClick={() => setIdentity((current) => ({ ...current, banner_url: "" }))} className={dangerButton}>Remove</button> : null}
              </div>
              <p className="mt-3 text-[11px] text-zinc-500">Images are converted to WebP and kept under 100 KB. Save to publish.</p>
            </div>
</>
) : null}
{is("header") ? (
<>
{headerBlock ? (
              <div className={panelCard}>
                <h3 className="mb-3 text-sm font-semibold">Header style</h3>
                <HeaderStylePicker style={headerBlock.style} theme={theme} onChange={(key, value) => setBlockStyle(headerBlock.id, key, value)} />
              </div>
            ) : null}
</>
) : null}
{is("stats") ? (
<>
{statsBlock ? (
              <div className={panelCard}>
                <h3 className="mb-3 text-sm font-semibold">Statistics style</h3>
                <StatsStylePicker style={statsBlock.style} theme={theme} onChange={(key, value) => setBlockStyle(statsBlock.id, key, value)} />
                <div className="mt-4 border-t border-white/10 pt-4">{blockToggles(statsBlock)}</div>
              </div>
            ) : null}
</>
) : null}
</>
        );

      case "sections":
        return (
          <>
            {is("arrange") ? (
<>
<div className={panelCard}>
              <h3 className="text-sm font-semibold">Arrangement</h3>
              <p className="mb-3 mt-1 text-xs text-zinc-400">Choose a starting arrangement, then fine-tune each section.</p>
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {([
                  ["canvas", "Free canvas", "Keep current positions"],
                  ["stacked", "Clean stack", "A full-width reading flow"],
                  ["showcase", "Media first", "Lead with a larger gallery"],
                ] as const).map(([id, label, detail]) => (
                  <button key={id} type="button" onClick={() => applyLayout(id)} aria-pressed={(theme.layout ?? "canvas") === id} className={`${choiceCard((theme.layout ?? "canvas") === id)} min-h-20`}>
                    <span className="text-sm font-semibold">{label}</span><span className="mt-1 block text-[11px] text-zinc-400">{detail}</span>
                  </button>
                ))}
              </div>
            </div>
</>
) : null}
{is("add") ? (
<>
<div className={panelCard}>
              <h3 className="mb-3 text-sm font-semibold">Add a section</h3>
              {addSectionButtons([["text", "Text"], ["quote", "Quote"], ["links", "Buttons"], ["gallery", "Gallery"], ["divider", "Divider"], ["spacer", "Spacer"]])}
            </div>
</>
) : null}
{is("edit") ? (
<>
<div className={panelCard}>
              <h3 className="mb-3 text-sm font-semibold">Your sections</h3>
              {sectionChips()}
              {selectedBlock ? (
                <div className="mt-3 space-y-4 border-t border-white/10 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold capitalize">{selectedBlock.type} settings</h4>
                    <button type="button" onClick={removeSelected} disabled={selectedBlock.locked} className={`min-h-10 rounded-xl px-3 text-sm text-red-300 disabled:text-zinc-500 ${FOCUS}`}>{selectedBlock.locked ? "Locked" : "Remove"}</button>
                  </div>
                  {selectedBlock.type === "header" || selectedBlock.type === "stats" ? (
                    <button type="button" onClick={() => { setCategory("header"); pickSub("header", selectedBlock.type === "stats" ? "stats" : "header"); }} className={`${ghostButton} w-full`}>Edit style in Header &amp; Stats</button>
                  ) : null}
                  {selectedBlock.type === "about" ? bioEditor() : null}
                  {["about", "text", "quote", "links", "gallery", "posts"].includes(selectedBlock.type) ? titleField(selectedBlock) : null}
                  {["text", "quote"].includes(selectedBlock.type) ? (
                    <label className="block"><span className={smallLabel}>Text</span><textarea rows={5} value={String(selectedBlock.config.body ?? "")} onChange={(event) => setConfig(selectedBlock.id, "body", event.target.value)} className={`${fieldClass} resize-y`} /></label>
                  ) : null}
                  {selectedBlock.type === "quote" ? (
                    <label className="block"><span className={smallLabel}>Attribution</span><input value={String(selectedBlock.config.author ?? "")} onChange={(event) => setConfig(selectedBlock.id, "author", event.target.value)} className={fieldClass} /></label>
                  ) : null}
                  {selectedBlock.type === "links" ? linksEditor(selectedBlock) : null}
                  {selectedBlock.type === "gallery" ? galleryEditor(selectedBlock) : null}
                  {blockToggles(selectedBlock)}
                </div>
              ) : (
                <p className="py-4 text-center text-xs text-zinc-500">Select a section here or on the preview to edit it.</p>
              )}
            </div>
</>
) : null}
</>
        );

      case "stickers": {
        const sticker = (theme.stickers ?? []).find((item) => item.id === selectedStickerId);
        return (
          <div className={panelCard}>
            <h3 className="text-sm font-semibold">Stickers and emoji</h3>
            <p className="mb-3 mt-1 text-xs text-zinc-400">Add an item, then drag it over the cover or bio preview. Select one to resize or rotate it.</p>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {availableStickerCategories.map((name) => (
                <button key={name} type="button" onClick={() => setStickerCategory(name)} aria-pressed={stickerCategory === name} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${FOCUS} ${stickerCategory === name ? "border-violet-300 bg-violet-400/15 text-violet-100" : "border-white/10 text-zinc-300"}`}>
                  {name}
                </button>
              ))}
            </div>
            <div className="mb-4 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
              {STICKERS.filter((item) => (stickerCategories[stickerCategory] ?? stickerCategories.All).includes(item.id)).map((item) => (
                <button key={item.id} type="button" onClick={() => addSticker("svg", item.id)} aria-label={`Add ${item.label} sticker`} className={`flex min-h-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-2 transition hover:border-violet-300/50 hover:bg-violet-400/10 motion-reduce:transition-none ${FOCUS}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt="" loading="lazy" className="h-10 w-10" />
                </button>
              ))}
            </div>
            <div className="mb-4 overflow-hidden rounded-2xl border border-white/10">
              <EmojiPicker
                onEmojiClick={(emojiData: EmojiClickData) => addSticker("emoji", emojiData.emoji)}
                theme={EmojiTheme.DARK}
                width="100%"
                height={300}
                searchPlaceHolder="Find an emoji"
                previewConfig={{ showPreview: false }}
                lazyLoadEmojis
              />
            </div>
            {sticker ? (
              <div className="space-y-4 rounded-2xl border border-violet-300/20 bg-violet-400/[0.06] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Selected sticker</p>
                  <button type="button" onClick={removeSelectedSticker} className={dangerButton}>Remove</button>
                </div>
                <RangeControl label="Size" value={sticker.size} min={5} max={40} onChange={(size) => updateSticker(sticker.id, { size })} />
                <RangeControl label="Rotation" value={sticker.rotation} min={-180} max={180} onChange={(rotation) => updateSticker(sticker.id, { rotation })} />
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-zinc-500">Choose an emoji or sticker to place it on your profile.</p>
            )}
            <p className="mt-3 text-right text-xs text-zinc-500">{(theme.stickers ?? []).length}/30 stickers</p>
          </div>
        );
      }

      case "typography":
        return (
          <>
            {is("fonts") ? (
<>
<div className={panelCard}>
              <h3 className="text-sm font-semibold">Font pairing</h3>
              <p className="mb-3 mt-1 text-xs text-zinc-400">Choose a font pairing and see it in the preview.</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["Inter", "Inter", "sans-serif"], ["Editorial", "Georgia, serif", "Georgia, serif"], ["Classic", "Arial, sans-serif", "Arial, sans-serif"], ["Mono", "monospace", "monospace"],
                ] as const).map(([label, value, family]) => (
                  <button key={label} type="button" onClick={() => setTheme((current) => ({ ...current, fontHeading: value, fontBody: label === "Editorial" ? "Inter" : value }))} aria-pressed={theme.fontHeading === value} className={`${choiceCard(theme.fontHeading === value)} min-h-20`}><span className="text-xl" style={{ fontFamily: family }}>Ag</span><span className="mt-1 block text-sm font-semibold">{label}</span></button>
                ))}
              </div>
              <label className="mt-3 block"><span className={smallLabel}>Body font</span><select value={theme.fontBody} onChange={(event) => setTheme((current) => ({ ...current, fontBody: event.target.value }))} className={fieldClass}><option value="Inter">Inter</option><option value="Georgia, serif">Georgia</option><option value="Arial, sans-serif">Arial</option><option value="Trebuchet MS, sans-serif">Trebuchet</option><option value="monospace">Monospace</option></select></label>
            </div>
</>
) : null}
{is("text") ? (
<>
<div className={panelCard}>
              <h3 className="mb-1 text-sm font-semibold">Section text</h3>
              <p className="mb-3 text-xs text-zinc-400">Pick a section (for example About for your bio), then adjust its font, size, alignment and colors.</p>
              {sectionChips()}
              {selectedBlock ? <div className="mt-3 border-t border-white/10 pt-4">{appearanceControls(selectedBlock)}</div> : null}
            </div>
</>
) : null}
</>
        );

      case "links":
        return (
          <>
            {is("buttons") ? (
<>
{linkBlocks.length === 0 && galleryBlocks.length === 0 ? (
              <div className={panelCard}><p className="text-sm text-zinc-300">You have no buttons or galleries yet. Add one to get started.</p></div>
            ) : null}
            {linkBlocks.map((block) => (
              <div key={block.id} className={`${panelCard} space-y-3 ${selectedId === block.id ? "ring-1 ring-violet-300/40" : ""}`} onFocusCapture={() => setSelectedId(block.id)}>
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Buttons and links</h3><button type="button" onClick={() => removeBlock(block)} disabled={block.locked} className={`min-h-10 rounded-xl px-3 text-sm text-red-300 disabled:text-zinc-500 ${FOCUS}`}>Remove</button></div>
                {titleField(block)}
                {linksEditor(block)}
              </div>
            ))}
</>
) : null}
{is("gallery") ? (
<>
{galleryBlocks.map((block) => (
              <div key={block.id} className={`${panelCard} space-y-3 ${selectedId === block.id ? "ring-1 ring-violet-300/40" : ""}`} onFocusCapture={() => setSelectedId(block.id)}>
                <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Gallery</h3><button type="button" onClick={() => removeBlock(block)} disabled={block.locked} className={`min-h-10 rounded-xl px-3 text-sm text-red-300 disabled:text-zinc-500 ${FOCUS}`}>Remove</button></div>
                {titleField(block)}
                {galleryEditor(block)}
              </div>
            ))}
            <div className={panelCard}>
              <h3 className="mb-3 text-sm font-semibold">Add</h3>
              {addSectionButtons([["links", "Buttons"], ["gallery", "Gallery"]])}
            </div>
</>
) : null}
</>
        );
    }
  };

  if (optimisticProfile) {
    return (
      <>
        <ProfileView
          profile={optimisticProfile}
          access={{ isOwner: true, canView: true, viewerId: profile.id }}
          stats={stats}
          isFollowing={false}
        />
        <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-4 z-[80] mx-auto max-w-xl rounded-2xl border border-violet-300/20 bg-[#141028]/95 px-4 py-3 text-center text-sm text-violet-100 shadow-xl backdrop-blur">
          {saving ? "Saving your profile…" : "Your profile is saved."}
        </div>
      </>
    );
  }

  if (wizardOpen) {
    return (
      <ProfileWizard
        username={profile.username}
        identity={identity}
        setIdentity={setIdentity}
        theme={theme}
        setTheme={setTheme}
        blocks={blocks}
        setBlockStyle={setBlockStyle}
        previewProfile={previewProfile}
        stats={stats}
        applyTemplate={applyTemplate}
        uploadControl={uploadControl}
        uploading={uploading}
        saving={saving}
        error={error}
        onFinish={save}
        onSkipAll={skipOnboarding}
        onOpenFullEditor={() => setWizardOpen(false)}
      />
    );
  }

  if (!isClient) return null;

  const statusLabel = saving ? "Saving…" : uploading ? "Uploading…" : dirty ? "Unsaved changes" : "No changes";

  const workspace = (
    <div className="fixed inset-0 z-[190] flex flex-col bg-[#07061a] text-zinc-100" role="region" aria-label="Profile Studio">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(124,58,237,.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(217,70,239,.10),transparent_50%)]" />

      <header className="relative z-10 shrink-0 border-b border-white/10 bg-[#0b0820]/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-5">
          <button type="button" onClick={requestClose} aria-label="Close Profile Studio" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-200 hover:bg-white/5 ${FOCUS}`}><ArrowLeft className="h-5 w-5" /></button>
          <p className="hidden shrink-0 text-lg font-extrabold tracking-tight sm:block" aria-label="Maestra Vibe"><span className="text-white">Maestra</span><span className="text-violet-400">Vibe</span></p>
          <div className="min-w-0 flex-1 sm:border-l sm:border-white/10 sm:pl-3">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">Profile Studio · @{profile.username}</p>
            <h1 className="truncate text-base font-semibold text-white sm:text-lg">Design your profile</h1>
          </div>
          <span role="status" aria-live="polite" className={`hidden shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs sm:inline-flex ${dirty ? "border-amber-300/30 bg-amber-400/10 text-amber-200" : "border-white/10 text-zinc-400"}`}>
            <span className={`h-2 w-2 rounded-full ${saving || uploading ? "animate-pulse bg-violet-300 motion-reduce:animate-none" : dirty ? "bg-amber-300" : "bg-emerald-400"}`} />{statusLabel}
          </span>
          <button type="button" onClick={() => setPreviewOpen(true)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-200 hover:bg-white/5 sm:px-4 ${FOCUS}`}><Eye className="h-4 w-4" /><span className="hidden sm:inline">Preview</span></button>
          <button type="button" onClick={() => void save()} disabled={saving || uploading !== null} className={`min-h-11 shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 text-sm font-bold text-white shadow-lg shadow-violet-950/40 hover:brightness-110 disabled:opacity-50 sm:px-5 ${FOCUS}`}>
            {saving ? "Saving..." : <><span className="sm:hidden">Save</span><span className="hidden sm:inline">Save changes</span></>}
          </button>
        </div>

        <div role="tablist" aria-label="Studio categories" className="flex gap-1.5 overflow-x-auto border-t border-white/10 px-2 py-2 [scrollbar-width:none] lg:hidden">
          {CATEGORIES.map(({ id, short, Icon }) => (
            <button key={id} type="button" role="tab" aria-selected={category === id} onClick={(event) => { selectCategory(id); event.currentTarget.scrollIntoView({ block: "nearest", inline: "center" }); }} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition motion-reduce:transition-none ${FOCUS} ${category === id ? "bg-violet-500/20 text-white ring-1 ring-violet-300/40" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
              <Icon className="h-4 w-4" />{short}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p role="alert" className="relative z-10 flex shrink-0 items-start justify-between gap-3 border-b border-red-400/30 bg-red-950/70 px-4 py-2.5 text-sm text-red-100">
          <span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss error" className={`-my-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 ${FOCUS}`}><X className="h-4 w-4" /></button>
        </p>
      ) : success ? (
        <p role="status" className="relative z-10 flex shrink-0 items-start justify-between gap-3 border-b border-emerald-400/20 bg-emerald-950/60 px-4 py-2.5 text-sm text-emerald-100">
          <span>{success}</span><button type="button" onClick={() => setSuccess(null)} aria-label="Dismiss message" className={`-my-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 ${FOCUS}`}><X className="h-4 w-4" /></button>
        </p>
      ) : null}

      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row">
        <nav aria-label="Studio categories" className="hidden w-[76px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-white/10 bg-[#0b0820]/70 p-3 lg:flex xl:w-[248px]">
          {CATEGORIES.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => selectCategory(id)} aria-current={category === id ? "page" : undefined} title={label} className={`group relative flex min-h-12 items-center justify-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition motion-reduce:transition-none xl:justify-start ${FOCUS} ${category === id ? "bg-violet-500/15 text-white ring-1 ring-violet-400/40 shadow-[inset_0_0_24px_rgba(139,92,246,.18)]" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
              {category === id ? <span aria-hidden="true" className="absolute left-0 top-2.5 h-7 w-1 rounded-full bg-violet-400" /> : null}
              <Icon className="h-5 w-5 shrink-0" /><span className="hidden xl:inline">{label}</span>
            </button>
          ))}
          <div className="mt-auto hidden rounded-2xl border border-violet-300/15 bg-violet-500/[0.07] p-4 text-xs leading-relaxed text-zinc-300 xl:block">
            <p className="mb-1 font-semibold text-violet-200">Live preview</p>
            Every change shows instantly in the preview. Press <span className="font-semibold text-white">Save changes</span> to publish it.
          </div>
        </nav>

        <section aria-label="Live preview" className={`min-w-0 overflow-y-auto overscroll-contain border-b border-white/10 lg:h-auto lg:flex-1 lg:shrink lg:border-b-0 ${panelOpen ? (previewLarge ? "h-[56dvh] shrink-0" : "h-[36dvh] shrink-0") : "min-h-0 flex-1"}`}>
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b0820]/85 px-3 py-2 backdrop-blur sm:px-5">
            <p className="min-w-0 truncate text-xs text-zinc-400">Live preview · {blocks.filter((block) => block.style.hidden !== true).length} visible sections</p>
            <div role="radiogroup" aria-label="Preview device" className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 lg:flex">
              {DEVICES.map(({ id, label, Icon }) => (
                <button key={id} type="button" role="radio" aria-checked={device === id} onClick={() => setDevice(id)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition motion-reduce:transition-none ${FOCUS} ${device === id ? "bg-violet-500/25 text-white" : "text-zinc-400 hover:text-white"}`}><Icon className="h-4 w-4" />{label}</button>
              ))}
            </div>
            <button type="button" onClick={() => setPreviewLarge((value) => !value)} aria-label={previewLarge ? "Make preview smaller" : "Make preview larger"} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 lg:hidden ${FOCUS}`}>{previewLarge ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}</button>
          </div>
          <div className="p-2 sm:p-5">
            <div className={`mx-auto w-full max-w-full rounded-[28px] border border-white/10 bg-zinc-900/60 p-2 shadow-[0_0_60px_rgba(124,58,237,.12)] transition-[max-width] duration-300 motion-reduce:transition-none sm:p-3 ${deviceFrame}`}>
              <ProfileRender
                profile={previewProfile}
                stats={stats}
                editable
                selectedBlockId={selectedId}
                onSelectBlock={selectCanvasBlock}
                onGeometryChange={setGeometry}
                selectedStickerId={selectedStickerId}
                onStickerSelect={(id) => {
                  setSelectedStickerId(id);
                  setCategory("stickers");
                  setPanelOpen(true);
                }}
                onStickerUpdate={updateSticker}
              />
            </div>
          </div>
        </section>

        {panelOpen ? null : (
          <button type="button" onClick={() => setPanelOpen(true)} className={"flex min-h-12 shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#0b0820]/95 px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-sm font-semibold text-white lg:hidden " + FOCUS}>
            <span className="inline-flex items-center gap-2"><currentCategory.Icon className="h-4 w-4 text-violet-300" />{currentCategory.label}</span>
            <span className="text-xs text-violet-300">Open tools</span>
          </button>
        )}

        <aside aria-label={currentCategory.label + " settings"} inert={!panelOpen} className={"flex flex-col overflow-hidden bg-[#0b0820]/60 transition-[width] duration-300 motion-reduce:transition-none lg:flex-none lg:border-white/10 " + (panelOpen ? "min-h-0 flex-1 lg:w-[400px] lg:border-l xl:w-[440px]" : "hidden lg:flex lg:w-0")}>
          <div className={"flex min-h-0 flex-1 flex-col transition-transform duration-300 motion-reduce:transition-none lg:w-[400px] xl:w-[440px] " + (panelOpen ? "translate-x-0" : "lg:translate-x-full")}>
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
              <currentCategory.Icon className="h-5 w-5 shrink-0 text-violet-300" />
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold text-white">{currentCategory.label}</h2>
                <p className="truncate text-[11px] text-zinc-400">{currentCategory.description}</p>
              </div>
              <button type="button" onClick={() => setPanelOpen(false)} aria-label="Close tools panel" className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-zinc-300 hover:bg-white/5 " + FOCUS}>
                <X className="hidden h-4 w-4 lg:block" /><ChevronDown className="h-5 w-5 lg:hidden" />
              </button>
            </div>
            {SUBS[category].length > 1 ? <SubTabs label={currentCategory.label + " tools"} items={SUBS[category]} value={sub} onChange={(id) => pickSub(category, id)} /> : null}
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-3 pb-4 pt-3 sm:px-4">{renderPanel()}</div>
            {showAdvanced ? (
              <Disclosure title="Position & Size" icon={<SlidersHorizontal className="h-4 w-4" />} open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)}>
                {sectionChips()}
                {positionTarget ? positionControls(positionTarget) : <p className="text-xs text-zinc-500">Select a section to adjust its position and size.</p>}
              </Disclosure>
            ) : null}
            <div className="shrink-0 border-t border-white/10 bg-[#0b0820]/95 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
              <button type="button" onClick={() => void save()} disabled={saving || uploading !== null} className={"min-h-12 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-500 text-sm font-bold text-white shadow-lg shadow-violet-950/40 disabled:opacity-50 " + FOCUS}>
                {saving ? "Saving..." : dirty ? "Save changes" : "Save"}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-[196] overflow-y-auto bg-[#07061a]" role="dialog" aria-modal="true" aria-label="Profile preview">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b0820]/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
            <p className="text-sm text-zinc-300">Preview · changes are not saved yet</p>
            <button type="button" onClick={() => setPreviewOpen(false)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-100 hover:bg-white/5 ${FOCUS}`}><X className="h-4 w-4" />Close preview</button>
          </div>
          <div className="pointer-events-none select-none">
            <ProfileView
              profile={previewProfile}
              access={{ isOwner: true, canView: true, viewerId: profile.id }}
              stats={stats}
              isFollowing={false}
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  return createPortal(workspace, document.body);
}