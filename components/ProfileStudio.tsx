// path: maestra-vibe/components/ProfileStudio.tsx  (poori file replace karo)
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
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

const MAX_IMAGE_BYTES = 100 * 1024;
const IMAGE_QUALITIES = [0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.28, 0.2];
type BlockType = ProfileBlock["type"];
const stickerCategories = {
  All: STICKERS.map((sticker) => sticker.id),
  Vibes: ["star", "bolt", "flame", "wow"],
  Love: ["heart"],
  Achievements: ["crown", "diamond", "check"],
} as const;

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

function messageOf(error: unknown, fallback: string) {
  return error && typeof error === "object" && "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;
}

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
      <input className="w-full accent-violet-400" type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

const fieldClass = "w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-400";
const smallLabel = "mb-1.5 block text-xs font-medium text-zinc-400";

export default function ProfileStudio({
  profile,
  stats = { followers: 0, following: 0 },
}: {
  profile: ProfileRecord;
  stats?: { followers: number; following: number };
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
  const [stickerCategory, setStickerCategory] = useState<keyof typeof stickerCategories>("All");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [optimisticProfile, setOptimisticProfile] = useState<ProfileRecord | null>(null);
  const [uploading, setUploading] = useState<"avatar" | "banner" | "gallery" | null>(null);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [activeTool, setActiveTool] = useState<"templates" | "skins" | "stickers" | "fonts" | "colors" | "layout">("templates");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;
  const previewProfile = normalizeProfileRecord({ ...profile, ...identity, theme, blocks });

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

  const selectCanvasBlock = (id: string) => {
    setSelectedId(id);
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

  const toggleSelected = () => {
    if (!selectedBlock || selectedBlock.locked) return;
    setBlockStyle(selectedBlock.id, "hidden", selectedBlock.style.hidden !== true);
  };

  const removeSelected = () => {
    if (!selectedBlock) return;
    if (selectedBlock.locked) {
      setError("This section belongs to every profile. You can move, resize and restyle it, but not remove it.");
      return;
    }
    setBlocks((current) => current.filter((block) => block.id !== selectedBlock.id));
    const next = blocks.find((block) => block.id !== selectedBlock.id);
    setSelectedId(next?.id ?? null);
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

  const uploadControl = (kind: "avatar" | "banner") => (
    <label className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5">
      {uploading === kind ? "Preparing..." : `Upload ${kind}`}
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
    <label key={key} className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-zinc-200">
      <span>{label}</span>
      <input aria-label={label} type="color" value={theme[key]} onChange={(event) => setTheme((current) => ({ ...current, [key]: event.target.value }))} className="h-12 w-14 cursor-pointer rounded-xl border-0 bg-transparent p-0" />
    </label>
  );

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

  return (
    <main className="mx-auto min-h-dvh max-w-[1440px] px-3 pb-[58dvh] pt-4 text-zinc-100 sm:px-5 lg:pb-8">
      <header className="sticky top-0 z-30 -mx-3 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-950/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300">Profile studio / @{profile.username}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Design your profile</h1>
        </div>
        <button onClick={save} disabled={saving || uploading !== null} className="min-h-12 rounded-2xl bg-violet-500 px-5 text-sm font-bold text-white shadow-lg shadow-violet-950/30 hover:bg-violet-400 disabled:opacity-50">
          {saving ? "Saving..." : "Save"}
        </button>
      </header>

      {error ? <p role="alert" className="fixed inset-x-3 bottom-4 z-[80] mx-auto max-w-xl rounded-2xl border border-red-400/30 bg-red-950/95 p-3 text-sm text-red-200 shadow-xl">{error}</p> : null}
      {success ? <p role="status" className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-950/40 p-3 text-sm text-emerald-200">{success}</p> : null}

      <div className="mb-4 hidden border-b border-white/10 pb-3 lg:block">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Add</span>
          {([
            ["text", "Text"], ["quote", "Quote"], ["links", "Buttons"], ["gallery", "Gallery"], ["divider", "Divider"], ["spacer", "Spacer"],
          ] as Array<[BlockType, string]>).map(([type, label]) => (
            <button key={type} onClick={() => addBlock(type)} className="shrink-0 rounded-md border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-violet-300/60 hover:bg-violet-400/10 hover:text-white">
              + {label}
            </button>
          ))}
        </div>
        <label className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-400 sm:ml-auto sm:max-w-xs">
          Profile visibility
          <select value={identity.visibility} onChange={(event) => setIdentity((current) => ({ ...current, visibility: event.target.value as typeof current.visibility }))} className="rounded-md border border-white/10 bg-zinc-900 px-2 py-2 text-zinc-100">
            <option value="public">Public</option><option value="followers">Followers</option><option value="private">Private</option>
          </select>
        </label>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <section className={`rounded-xl border border-white/10 bg-zinc-900/80 p-4 ${activeTool === "templates" ? "block" : "hidden"}`}>
            <h2 className="text-base font-semibold">Choose a starting look</h2>
            <p className="mb-3 mt-1 text-xs text-zinc-400">Swipe through live style previews. The canvas updates as soon as you choose one.</p>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
              {Object.values(templateCatalog).map((template, index) => {
                const threeDimensional = index % 3 !== 1;
                return (
                  <button key={template.id} onClick={() => applyTemplate(template.id)} aria-pressed={identity.template === template.id} className={`w-[220px] shrink-0 snap-start rounded-[24px] border p-2 text-left transition ${identity.template === template.id ? "border-violet-300 bg-violet-400/10 ring-2 ring-violet-400/40" : "border-white/10 bg-white/[0.03]"}`}>
                    <div className="flex h-32 items-center justify-center overflow-hidden rounded-[18px]" style={{ background: template.background.value }}>
                      <div className={`w-[78%] rounded-2xl border p-3 shadow-xl ${threeDimensional ? "[transform:perspective(520px)_rotateY(-9deg)_rotateX(5deg)]" : ""}`} style={{ background: template.colors.card, borderColor: template.colors.border, color: template.colors.text, boxShadow: template.shadow, borderRadius: `${template.radius}px`, fontFamily: template.fonts.body }}>
                        <div className="mb-3 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full text-sm" style={{ background: template.colors.accent, color: template.colors.buttonText }}>{(identity.name || profile.username).slice(0, 1).toUpperCase()}</span><span className="truncate text-xs font-semibold" style={{ fontFamily: template.fonts.heading }}>{identity.name || `@${profile.username}`}</span></div>
                        <div className="mb-2 h-2 w-3/4 rounded-full" style={{ background: template.colors.accent }} />
                        <div className="grid grid-cols-2 gap-2"><span className="h-7 rounded-lg" style={{ background: template.colors.cardAlt }} /><span className="h-7 rounded-lg" style={{ background: template.colors.cardAlt }} /></div>
                        {template.stickers?.[0] ? <span className="mt-2 block text-right text-sm">{template.stickers[0].value}</span> : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-3"><span className="font-semibold">{template.name}</span><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] text-zinc-300">{threeDimensional ? "3D" : "2D"}</span></div>
                    <p className="px-1 pb-1 text-xs leading-relaxed text-zinc-400">{template.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

        <section className="min-w-0 rounded-xl border border-white/10 bg-zinc-900/60 p-2 sm:p-4">
          <div className="mb-3 flex items-center justify-between px-1 text-xs text-zinc-500">
            <span>Canvas</span><span>{blocks.filter((block) => block.style.hidden !== true).length} visible sections</span>
          </div>
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
              setActiveTool("stickers");
            }}
            onStickerUpdate={updateSticker}
          />
        </section>
        </div>

        <aside className={`fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-white/15 bg-zinc-950/95 shadow-[0_-18px_70px_rgba(0,0,0,.55)] backdrop-blur-2xl ${panelCollapsed ? "h-[68px] lg:h-auto" : "max-h-[58dvh]"} lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:rounded-[26px]`}>
          <div className="flex shrink-0 items-center border-b border-white/10">
          <div role="tablist" aria-label="Profile editor tools" className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-2 py-2 scrollbar-thin">
            {([
              ["templates", "Templates"], ["skins", "Skins"], ["stickers", "Stickers"], ["fonts", "Fonts"], ["colors", "Colors"], ["layout", "Layout"],
            ] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={activeTool === id} onClick={() => { setActiveTool(id); setPanelCollapsed(false); }} className={`min-h-12 shrink-0 rounded-2xl px-4 text-sm font-semibold transition ${activeTool === id ? "bg-violet-400/15 text-violet-200 ring-1 ring-violet-300/30" : "text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={() => setPanelCollapsed((collapsed) => !collapsed)} aria-label={panelCollapsed ? "Expand editor panel" : "Collapse editor panel"} className="min-h-12 shrink-0 px-4 text-lg text-zinc-300 lg:hidden">{panelCollapsed ? "⌃" : "⌄"}</button>
          </div>
          <div className={`${panelCollapsed ? "hidden" : "min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4"}`}>
          <section className={`rounded-xl border border-white/10 bg-zinc-900 p-4 ${activeTool === "templates" ? "block" : "hidden"}`}>
            <h2 className="text-sm font-semibold">Live template previews</h2>
            <p className="mt-1 text-xs leading-relaxed text-zinc-400">Swipe the cards above the canvas to apply a look. Colors, paired fonts, surfaces, background and starter stickers update together.</p>
          </section>

          <section className={`rounded-xl border border-white/10 bg-zinc-900 p-4 ${activeTool === "skins" ? "block" : "hidden"}`}>
            <h2 className="text-base font-semibold">Surface and depth</h2><p className="mb-3 mt-1 text-xs text-zinc-400">Choose a finish for your profile sections.</p>
            <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2">
              {([
                { id: "glass", title: "Glass", detail: "Blur and luminous edges", effect: "bg-white/15 backdrop-blur-xl border border-white/40" },
                { id: "soft", title: "Soft", detail: "Warm layered surfaces", effect: "border border-white/20 shadow-lg" },
                { id: "flat", title: "Flat", detail: "Minimal, transparent cards", effect: "border border-white/40" },
                { id: "dimensional", title: "Dimension", detail: "Depth and 3D highlights", effect: "border border-white/40 shadow-2xl [transform:perspective(500px)_rotateY(-10deg)_rotateX(5deg)]" },
                { id: "glow", title: "Glow", detail: "Luminous accent edges", effect: "border border-violet-300/50 shadow-[0_0_28px_rgba(168,85,247,.35)]" },
                { id: "tilt", title: "Tilt", detail: "Playful angled surfaces", effect: "border border-white/30 shadow-xl [transform:perspective(500px)_rotateY(-9deg)_rotateX(5deg)]" },
              ] as const).map((skin) => (
                <button key={skin.id} onClick={() => setTheme((current) => ({ ...current, skin: skin.id }))} aria-pressed={(theme.skin ?? "glass") === skin.id} className={`w-[190px] shrink-0 snap-start rounded-[24px] border p-3 text-left ${(theme.skin ?? "glass") === skin.id ? "border-violet-300 bg-violet-400/10 ring-2 ring-violet-400/40" : "border-white/10 bg-white/[0.03]"}`}>
                  <div className="flex h-28 items-center justify-center rounded-[18px] bg-gradient-to-br from-violet-500/30 via-zinc-800 to-fuchsia-500/20"><div className={`w-3/4 rounded-2xl p-4 ${skin.effect}`} style={{ backgroundColor: skin.id === "soft" ? theme.cardAlt : skin.id === "flat" ? "transparent" : undefined }}><div className="mb-3 h-2 w-3/4 rounded-full bg-white/80" /><div className="h-2 w-1/2 rounded-full bg-white/35" /><div className="mt-4 h-6 rounded-lg bg-white/20" /></div></div>
                  <span className="mt-3 block font-semibold">{skin.title}</span><span className="mt-1 block text-xs text-zinc-400">{skin.detail}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={`rounded-xl border border-white/10 bg-zinc-900 p-4 ${activeTool === "stickers" ? "block" : "hidden"}`}>
            <h2 className="text-base font-semibold">Stickers and emoji</h2>
            <p className="mb-3 mt-1 text-xs text-zinc-400">Add an item, then drag it over the cover or bio preview. Select one to resize or rotate it.</p>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {(Object.keys(stickerCategories) as Array<keyof typeof stickerCategories>).map((category) => (
                <button key={category} onClick={() => setStickerCategory(category)} aria-pressed={stickerCategory === category} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${stickerCategory === category ? "border-violet-300 bg-violet-400/15 text-violet-100" : "border-white/10 text-zinc-300"}`}>
                  {category}
                </button>
              ))}
            </div>
            <div className="mb-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {STICKERS.filter((sticker) => stickerCategories[stickerCategory].some((id) => id === sticker.id)).map((sticker) => (
                <button key={sticker.id} onClick={() => addSticker("svg", sticker.id)} aria-label={`Add ${sticker.label} sticker`} className="flex min-h-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-2 transition hover:border-violet-300/50 hover:bg-violet-400/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sticker.src} alt="" loading="lazy" className="h-10 w-10" />
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
            {selectedStickerId ? (() => {
              const sticker = (theme.stickers ?? []).find((item) => item.id === selectedStickerId);
              if (!sticker) return null;
              return (
                <div className="space-y-4 rounded-2xl border border-violet-300/20 bg-violet-400/[0.06] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Selected sticker</p>
                    <button onClick={removeSelectedSticker} className="min-h-11 rounded-xl border border-red-300/20 px-4 text-sm text-red-200 hover:bg-red-400/10">Remove</button>
                  </div>
                  <RangeControl label="Size" value={sticker.size} min={5} max={40} onChange={(size) => updateSticker(sticker.id, { size })} />
                  <RangeControl label="Rotation" value={sticker.rotation} min={-180} max={180} onChange={(rotation) => updateSticker(sticker.id, { rotation })} />
                </div>
              );
            })() : (
              <p className="rounded-xl border border-dashed border-white/10 p-3 text-center text-xs text-zinc-500">Choose an emoji or sticker to place it on your profile.</p>
            )}
            <p className="mt-3 text-right text-xs text-zinc-500">{(theme.stickers ?? []).length}/30 stickers</p>
          </section>

          <section className={`rounded-xl border border-white/10 bg-zinc-900 p-4 ${activeTool === "fonts" ? "block" : "hidden"}`}>
            <h2 className="text-base font-semibold">Typography</h2><p className="mb-3 mt-1 text-xs text-zinc-400">Choose a font pairing and see it in the preview.</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["Inter", "Inter", "sans-serif"], ["Editorial", "Georgia, serif", "Georgia, serif"], ["Classic", "Arial, sans-serif", "Arial, sans-serif"], ["Mono", "monospace", "monospace"],
              ] as const).map(([label, value, family]) => (
                <button key={label} onClick={() => setTheme((current) => ({ ...current, fontHeading: value, fontBody: label === "Editorial" ? "Inter" : value }))} aria-pressed={theme.fontHeading === value} className={`min-h-24 rounded-2xl border p-3 text-left ${theme.fontHeading === value ? "border-violet-300 bg-violet-400/10 ring-2 ring-violet-400/30" : "border-white/10 bg-white/[0.03]"}`}><span className="text-xl" style={{ fontFamily: family }}>Ag</span><span className="mt-1 block text-sm font-semibold">{label}</span></button>
              ))}
            </div>
            <label className="mt-3 block"><span className={smallLabel}>Body font</span><select value={theme.fontBody} onChange={(event) => setTheme((current) => ({ ...current, fontBody: event.target.value }))} className={`${fieldClass} min-h-12`}><option value="Inter">Inter</option><option value="Georgia, serif">Georgia</option><option value="Arial, sans-serif">Arial</option><option value="Trebuchet MS, sans-serif">Trebuchet</option><option value="monospace">Monospace</option></select></label>
          </section>

          <section className={`rounded-xl border border-white/10 bg-zinc-900 p-4 ${activeTool === "colors" ? "block" : "hidden"}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Color palette</h2>
            </div>
            <div className="space-y-2">
              {themeColor("page", "Page color")}
              {themeColor("accent", "Accent color")}
              {themeColor("text", "Text color")}
              {themeColor("buttonText", "Button text")}
            </div>
            <label className="mt-3 block">
              <span className={smallLabel}>Page background</span>
              <select value={theme.backgroundType} onChange={(event) => setTheme((current) => ({ ...current, backgroundType: event.target.value as ProfileTheme["backgroundType"] }))} className={fieldClass}>
                <option value="solid">Solid color</option><option value="gradient">Template background</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className={smallLabel}>Button style</span>
              <select value={theme.buttonStyle} onChange={(event) => setTheme((current) => ({ ...current, buttonStyle: event.target.value as ProfileTheme["buttonStyle"] }))} className={fieldClass}>
                <option value="filled">Filled</option><option value="outline">Outline</option><option value="ghost">Ghost</option>
              </select>
            </label>
            <div className="mt-4 border-t border-white/10 pt-3">
              <p className={smallLabel}>Profile images</p>
              <div className="flex flex-wrap gap-2">{uploadControl("avatar")}{uploadControl("banner")}</div>
              <p className="mt-2 text-[11px] text-zinc-500">Images are converted to WebP and kept under 100 KB.</p>
            </div>
          </section>

          <section className={`rounded-xl border border-white/10 bg-zinc-900 p-4 ${activeTool === "layout" ? "block" : "hidden"}`}>
            <h2 className="text-base font-semibold">Arrange your profile</h2>
            <p className="mb-3 mt-1 text-xs text-zinc-400">Choose a starting arrangement, add sections, then select a section to edit it.</p>
            <div className="mb-4 grid gap-2 sm:grid-cols-3">
              {([
                ["canvas", "Free canvas", "Keep current positions"],
                ["stacked", "Clean stack", "A full-width reading flow"],
                ["showcase", "Media first", "Lead with a larger gallery"],
              ] as const).map(([id, label, detail]) => (
                <button key={id} onClick={() => applyLayout(id)} aria-pressed={(theme.layout ?? "canvas") === id} className={`min-h-24 rounded-2xl border p-3 text-left ${theme.layout === id ? "border-violet-300 bg-violet-400/10 ring-2 ring-violet-400/30" : "border-white/10 bg-white/[0.03]"}`}>
                  <span className="text-sm font-semibold">{label}</span><span className="mt-1 block text-xs text-zinc-400">{detail}</span>
                </button>
              ))}
            </div>
            <label className="mb-4 block"><span className={smallLabel}>Profile visibility</span><select value={identity.visibility} onChange={(event) => setIdentity((current) => ({ ...current, visibility: event.target.value as typeof current.visibility }))} className={`${fieldClass} min-h-12`}><option value="public">Public</option><option value="followers">Followers</option><option value="private">Private</option></select></label>
            <div className="mb-4">
              <p className={smallLabel}>Add a section</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {([[ "text", "Text" ], [ "quote", "Quote" ], [ "links", "Buttons" ], [ "gallery", "Gallery" ], [ "divider", "Divider" ], [ "spacer", "Spacer" ]] as Array<[BlockType, string]>).map(([type, label]) => <button key={type} onClick={() => addBlock(type)} className="min-h-12 shrink-0 rounded-xl border border-white/10 px-4 text-sm text-zinc-200">+ {label}</button>)}
              </div>
            </div>
            <div className="mb-4">
              <p className={smallLabel}>Profile images</p>
              <div className="grid grid-cols-2 gap-2">{uploadControl("avatar")}{uploadControl("banner")}</div>
            </div>
            <div className="mb-4 border-t border-white/10 pt-4">
              <p className={smallLabel}>Sections</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {blocks.map((block) => <button key={block.id} onClick={() => setSelectedId(block.id)} aria-pressed={selectedId === block.id} className={`min-h-11 shrink-0 rounded-xl border px-3 text-sm capitalize ${selectedId === block.id ? "border-violet-300 bg-violet-400/15 text-white" : "border-white/10 text-zinc-300"}`}>{block.type}</button>)}
              </div>
            </div>
            {selectedBlock ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold capitalize">{selectedBlock.type} settings</h2>
                  <button onClick={removeSelected} disabled={selectedBlock.locked} className="min-h-10 rounded-xl px-3 text-sm text-red-300 disabled:text-zinc-500">{selectedBlock.locked ? "Locked" : "Remove"}</button>
                </div>

                {selectedBlock.type === "header" ? (
                  <>
                    <label className="mb-3 block"><span className={smallLabel}>Display name</span><input value={identity.name} onChange={(event) => setIdentity((current) => ({ ...current, name: event.target.value }))} className={fieldClass} /></label>
                    <div className="mb-3 flex flex-wrap items-center gap-2">{uploadControl("avatar")}{uploadControl("banner")}</div>
                    <HeaderStylePicker style={selectedBlock.style} theme={theme} onChange={(key, value) => setBlockStyle(selectedBlock.id, key, value)} />
                  </>
                ) : null}

                {selectedBlock.type === "stats" ? (
                  <StatsStylePicker style={selectedBlock.style} theme={theme} onChange={(key, value) => setBlockStyle(selectedBlock.id, key, value)} />
                ) : null}

                {selectedBlock.type === "about" ? (
                  <div className="mb-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <label htmlFor="profile-bio" className="text-xs font-medium text-zinc-400">About text</label>
                      <button type="button" onClick={() => void generateBio()} disabled={generatingBio} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/10 px-3 text-xs font-semibold text-violet-200 hover:bg-violet-400/20 disabled:opacity-50">
                        <Sparkles className="h-4 w-4" />{generatingBio ? "Generating..." : "Generate bio"}
                      </button>
                    </div>
                    <textarea id="profile-bio" rows={5} maxLength={400} value={identity.bio} onChange={(event) => setIdentity((current) => ({ ...current, bio: event.target.value }))} className={`${fieldClass} resize-y`} />
                  </div>
                ) : null}

                {["about", "text", "quote", "links", "gallery", "posts"].includes(selectedBlock.type) ? (
                  <label className="mb-3 block"><span className={smallLabel}>Section title</span><input value={String(selectedBlock.config.title ?? "")} onChange={(event) => setConfig(selectedBlock.id, "title", event.target.value)} className={fieldClass} /></label>
                ) : null}

                {["text", "quote"].includes(selectedBlock.type) ? (
                  <label className="mb-3 block"><span className={smallLabel}>Text</span><textarea rows={5} value={String(selectedBlock.config.body ?? "")} onChange={(event) => setConfig(selectedBlock.id, "body", event.target.value)} className={`${fieldClass} resize-y`} /></label>
                ) : null}

                {selectedBlock.type === "quote" ? (
                  <label className="mb-3 block"><span className={smallLabel}>Attribution</span><input value={String(selectedBlock.config.author ?? "")} onChange={(event) => setConfig(selectedBlock.id, "author", event.target.value)} className={fieldClass} /></label>
                ) : null}

                {selectedBlock.type === "links" ? (
                  <div className="mb-3 space-y-2">
                    <p className={smallLabel}>Buttons and links</p>
                    {((selectedBlock.config.links as Array<{ text?: string; href?: string }>) ?? []).map((link, index, all) => (
                      <div key={`${index}-${link.href}`} className="rounded-lg border border-white/10 p-2">
                        <input aria-label="Button label" placeholder="Button label" value={link.text ?? ""} onChange={(event) => setConfig(selectedBlock.id, "links", all.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item))} className={`${fieldClass} mb-2`} />
                        <div className="flex gap-2">
                          <input aria-label="Button URL" placeholder="https://..." value={link.href ?? ""} onChange={(event) => setConfig(selectedBlock.id, "links", all.map((item, itemIndex) => itemIndex === index ? { ...item, href: event.target.value } : item))} className={`${fieldClass} min-w-0`} />
                          <button aria-label="Remove link" onClick={() => setConfig(selectedBlock.id, "links", all.filter((_item, itemIndex) => itemIndex !== index))} className="px-2 text-red-300">×</button>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => setConfig(selectedBlock.id, "links", [...(((selectedBlock.config.links as Array<{ text?: string; href?: string }>) ?? [])), { text: "New button", href: "https://" }])} className="w-full rounded-md border border-dashed border-white/15 px-3 py-2 text-xs text-zinc-300 hover:border-violet-300/50">+ Add button</button>
                  </div>
                ) : null}

                {selectedBlock.type === "gallery" ? (() => {
                  const photos = (selectedBlock.config.images as string[]) ?? [];
                  return (
                    <div className="mb-3">
                      <p className={smallLabel}>Photos ({photos.length}/12)</p>
                      <div className="mb-2 grid grid-cols-4 gap-2">
                        {photos.map((url, index) => (
                          <div key={`${url}-${index}`} className="relative aspect-square overflow-hidden rounded-md bg-zinc-800">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                            <button aria-label="Remove photo" onClick={() => setConfig(selectedBlock.id, "images", photos.filter((_item, itemIndex) => itemIndex !== index))} className="absolute right-0.5 top-0.5 rounded-full bg-black/70 px-1.5 text-xs text-white">×</button>
                          </div>
                        ))}
                      </div>
                      <label className="inline-flex cursor-pointer items-center rounded-md border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5">
                        {uploading === "gallery" ? "Uploading..." : photos.length >= 12 ? "Gallery is full" : "Add photos"}
                        <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading !== null || photos.length >= 12} onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; if (files.length) void uploadGallery(selectedBlock.id, files); }} />
                      </label>
                    </div>
                  );
                })() : null}

                <label className="mb-3 block"><span className={smallLabel}>Section visibility</span><select value={selectedBlock.visibility} onChange={(event) => updateBlock(selectedBlock.id, (block) => ({ ...block, visibility: event.target.value as ProfileBlock["visibility"] }))} className={fieldClass}><option value="everyone">Everyone</option><option value="followers">Followers</option><option value="only_me">Only me</option></select></label>
                <button onClick={toggleSelected} disabled={selectedBlock.locked} className="mb-3 w-full rounded-md border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40">{selectedBlock.style.hidden === true ? "Show section" : "Hide section"}</button>
                <label className="mb-3 flex items-center justify-between gap-3 text-xs text-zinc-300">
                  <span>Text only (no card)</span>
                  <input type="checkbox" checked={selectedBlock.style.textOnly === true} onChange={(event) => setBlockStyle(selectedBlock.id, "textOnly", event.target.checked)} className="h-5 w-5 accent-violet-400" />
                </label>

                <div className="space-y-3 border-t border-white/10 pt-3">
                  <p className={smallLabel}>Position and size</p>
                  {(["x", "y", "width", "height"] as const).map((key) => {
                    const geometry = getBlockGeometry(selectedBlock, blocks.indexOf(selectedBlock));
                    const limits = key === "x" || key === "y" ? [0, 95] : [5, 100];
                    return <RangeControl key={key} label={key === "x" ? "Horizontal" : key === "y" ? "Vertical" : key === "width" ? "Width" : "Height"} value={geometry[key]} min={limits[0]} max={limits[1]} onChange={(value) => setGeometry(selectedBlock.id, { ...geometry, [key]: value })} />;
                  })}
                  <p className="pt-1 text-[10px] text-zinc-500">Drag the section handle or resize its lower-right corner on the canvas.</p>
                </div>

                <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                  <p className={smallLabel}>Typography and appearance</p>
                  <label className="flex items-center justify-between gap-3 text-xs text-zinc-400"><span>Background</span><input type="color" value={String(selectedBlock.style.backgroundColor ?? "#22212a")} onChange={(event) => setBlockStyle(selectedBlock.id, "backgroundColor", event.target.value)} className="h-8 w-11 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
                  <label className="flex items-center justify-between gap-3 text-xs text-zinc-400"><span>Text color</span><input type="color" value={String(selectedBlock.style.textColor ?? theme.text)} onChange={(event) => setBlockStyle(selectedBlock.id, "textColor", event.target.value)} className="h-8 w-11 cursor-pointer rounded border-0 bg-transparent p-0" /></label>
                  <label className="block"><span className={smallLabel}>Font</span><select value={String(selectedBlock.style.fontFamily ?? theme.fontBody)} onChange={(event) => setBlockStyle(selectedBlock.id, "fontFamily", event.target.value)} className={fieldClass}><option value="Georgia, serif">Georgia</option><option value="Inter">Inter</option><option value="Arial, sans-serif">Arial</option><option value="Trebuchet MS, sans-serif">Trebuchet</option><option value="monospace">Monospace</option></select></label>
                  <label className="block"><span className={smallLabel}>Text alignment</span><select value={String(selectedBlock.style.textAlign ?? "left")} onChange={(event) => setBlockStyle(selectedBlock.id, "textAlign", event.target.value)} className={fieldClass}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></label>
                  <RangeControl label="Text size" value={Number(selectedBlock.style.fontSize ?? 16)} min={10} max={40} onChange={(value) => setBlockStyle(selectedBlock.id, "fontSize", value)} />
                  <RangeControl label="Corner roundness" value={Number(selectedBlock.style.borderRadius ?? 18)} min={0} max={48} onChange={(value) => setBlockStyle(selectedBlock.id, "borderRadius", value)} />
                  {selectedBlock.type === "links" ? <label className="block"><span className={smallLabel}>Button appearance</span><select value={String(selectedBlock.style.buttonStyle ?? theme.buttonStyle)} onChange={(event) => setBlockStyle(selectedBlock.id, "buttonStyle", event.target.value)} className={fieldClass}><option value="filled">Filled</option><option value="outline">Outline</option><option value="ghost">Ghost</option></select></label> : null}
                </div>
              </>
            ) : (
              <div className="py-6 text-center">
                <h2 className="text-sm font-semibold">Select a section</h2>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">Choose an element on the canvas to edit its content, placement, size, and style.</p>
              </div>
            )}
          </section>
          </div>
        </aside>
      </div>
    </main>
  );
}