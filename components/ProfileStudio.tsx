// path: maestra-vibe/components/ProfileStudio.tsx  (poori file replace karo)
"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ProfileBlock, ProfileRecord, ProfileTheme } from "@/lib/profile-schema";
import { templateCatalog, type TemplateId } from "@/lib/templates";
import ProfileCanvas, { getBlockGeometry, type BlockGeometry } from "@/components/ProfileCanvas";

const MAX_IMAGE_BYTES = 100 * 1024;
const IMAGE_QUALITIES = [0.86, 0.76, 0.66, 0.56, 0.46, 0.36, 0.28, 0.2];
type BlockType = ProfileBlock["type"];

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

function defaultConfig(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "about": return { title: "About" };
    case "links": return { title: "Links", links: [] };
    case "gallery": return { title: "Gallery", images: [] };
    case "quote": return { title: "Quote", body: "Write something worth remembering." };
    case "divider": return {};
    case "spacer": return {};
    case "stats": return { title: "Stats" };
    case "posts": return { title: "Recent posts" };
    case "header": return {};
    default: return { title: "New section", body: "Write your text here." };
  }
}

function defaultBlocks(profile: ProfileRecord): ProfileBlock[] {
  const defaults: Array<{ type: BlockType; locked: boolean }> = [
    { type: "header", locked: true },
    { type: "stats", locked: true },
    { type: "about", locked: false },
    { type: "links", locked: false },
    { type: "gallery", locked: false },
  ];
  return defaults.map(({ type, locked }, index) => ({
    id: `draft-default-${index}`,
    profile_id: profile.id,
    type,
    position: index,
    width: "full",
    config: defaultConfig(type),
    style: {},
    visibility: "everyone",
    locked,
  }));
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
  const [identity, setIdentity] = useState({
    name: profile.name ?? "",
    bio: profile.bio ?? "",
    avatar_url: profile.avatar_url ?? "",
    banner_url: profile.banner_url ?? "",
    visibility: profile.visibility ?? "public",
    template: (profile.template as TemplateId) ?? "aurora",
  });
  const [theme, setTheme] = useState<ProfileTheme>(profile.theme);
  const [blocks, setBlocks] = useState<ProfileBlock[]>(() => profile.blocks.length ? profile.blocks : defaultBlocks(profile));
  const [selectedId, setSelectedId] = useState<string | null>(() => profile.blocks[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const [mobileInspectorTab, setMobileInspectorTab] = useState<"section" | "page">("section");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const inspectorRef = useRef<HTMLElement>(null);

  const selectedBlock = blocks.find((block) => block.id === selectedId) ?? null;
  const previewProfile = { ...profile, ...identity, theme } as ProfileRecord;

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

  const selectCanvasBlock = (id: string) => {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 1023px)").matches) {
      setMobileInspectorTab("section");
      setMobileInspectorOpen(true);
      window.setTimeout(() => document.getElementById(`block-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    }
  };

  const openMobileInspector = (tab: "section" | "page") => {
    setMobileInspectorTab(tab);
    setMobileInspectorOpen(true);
  };

  const addBlock = (type: BlockType) => {
    const block: ProfileBlock = {
      id: `draft-${crypto.randomUUID()}`,
      profile_id: profile.id,
      type,
      position: blocks.length,
      width: "full",
      config: defaultConfig(type),
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

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const { data: { user }, error: sessionError } = await supabase.auth.getUser();
      if (sessionError) throw new Error(`Session check: ${sessionError.message}`);
      if (!user || user.id !== profile.id) {
        throw new Error("Your browser session does not own this profile. Log out, log back in, and retry.");
      }

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
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .select("id")
        .maybeSingle();
      if (profileError) throw new Error(`Profile details: ${profileError.message}`);
      if (!savedProfile) throw new Error("No profile row was updated. Log in again and retry.");

      const activeIds = new Set(blocks.map((block) => block.id));
      for (const [position, block] of blocks.entries()) {
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
      }

      const deletedIds = profile.blocks.filter((block) => !block.locked && !activeIds.has(block.id)).map((block) => block.id);
      if (deletedIds.length) {
        const { error: deleteError } = await supabase
          .from("profile_blocks")
          .delete()
          .in("id", deletedIds)
          .eq("profile_id", profile.id);
        if (deleteError) throw new Error(`Removed sections: ${deleteError.message}`);
      }
      setSuccess("Your profile layout is saved.");
      router.replace(`/${profile.username}`);
      router.refresh();
    } catch (saveError) {
      setError(messageOf(saveError, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  };

  const uploadControl = (kind: "avatar" | "banner") => (
    <label className="inline-flex cursor-pointer items-center rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-white/5">
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
    <label className="flex items-center justify-between gap-3 text-xs text-zinc-400">
      <span>{label}</span>
      <input type="color" value={theme[key]} onChange={(event) => setTheme((current) => ({ ...current, [key]: event.target.value }))} className="h-8 w-11 cursor-pointer rounded border-0 bg-transparent p-0" />
    </label>
  );

  return (
    <main className={`mx-auto max-w-375 px-3 py-5 text-zinc-100 sm:px-5 ${mobileInspectorOpen ? "pb-[52vh]" : ""} lg:pb-5`}>
      <header className="sticky top-0 z-30 -mx-3 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-zinc-950/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300">Profile studio / @{profile.username}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Design your profile</h1>
        </div>
        <button onClick={save} disabled={saving || uploading !== null} className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50">
          {saving ? "Saving layout..." : "Save changes"}
        </button>
      </header>

      {error ? <p role="alert" className="mb-3 rounded-lg border border-red-400/30 bg-red-950/50 p-3 text-sm text-red-200">{error}</p> : null}
      {success ? <p role="status" className="mb-3 rounded-lg border border-emerald-400/30 bg-emerald-950/40 p-3 text-sm text-emerald-200">{success}</p> : null}

      <div className="mb-4 border-b border-white/10 pb-3">
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

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-xl border border-white/10 bg-zinc-900/60 p-2 sm:p-4">
          <div className="mb-3 flex items-center justify-between px-1 text-xs text-zinc-500">
            <span>Canvas</span><span>{blocks.filter((block) => block.style.hidden !== true).length} visible sections</span>
          </div>
          <ProfileCanvas
            profile={previewProfile}
            blocks={blocks}
            stats={stats}
            editable
            selectedBlockId={selectedId}
            onSelectBlock={selectCanvasBlock}
            onGeometryChange={setGeometry}
          />
        </section>

        <div className={`fixed inset-x-3 bottom-19 z-40 mx-auto max-w-md gap-2 rounded-xl border border-white/15 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur ${mobileInspectorOpen ? "hidden" : "flex"} lg:hidden`}>
          <button onClick={() => openMobileInspector("section")} className="min-w-0 flex-1 truncate rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-white">
            Edit {selectedBlock ? selectedBlock.type : "section"}
          </button>
          <button onClick={() => openMobileInspector("page")} className="shrink-0 rounded-lg border border-white/10 px-3 py-2.5 text-sm text-zinc-200">
            Page styles
          </button>
        </div>

        <aside ref={inspectorRef} className={`min-w-0 space-y-3 overflow-y-auto bg-zinc-950 p-3 ${mobileInspectorOpen ? "fixed inset-x-0 bottom-0 z-50 max-h-[48vh] rounded-t-2xl border-t border-white/15 shadow-2xl" : "hidden"} lg:sticky lg:inset-x-auto lg:bottom-auto lg:top-24 lg:z-10 lg:block lg:max-h-[calc(100vh-7rem)] lg:rounded-xl lg:border lg:border-white/10 lg:shadow-none`}>
          <button onClick={() => setMobileInspectorOpen(false)} className="ml-auto block rounded-full bg-zinc-800 px-3 py-1.5 text-xs lg:hidden">Close ✕</button>

          <section className={`rounded-xl border border-white/10 bg-zinc-900 p-4 ${mobileInspectorTab === "page" ? "block" : "hidden lg:block"}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Page design</h2>
              <select value={identity.template} onChange={(event) => applyTemplate(event.target.value as TemplateId)} className="max-w-28 rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-xs">
                {Object.values(templateCatalog).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
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
              <span className={smallLabel}>Heading font</span>
              <select value={theme.fontHeading} onChange={(event) => setTheme((current) => ({ ...current, fontHeading: event.target.value }))} className={fieldClass}>
                <option value="Georgia, serif">Georgia</option><option value="Inter">Inter</option><option value="Arial, sans-serif">Arial</option><option value="Trebuchet MS, sans-serif">Trebuchet</option><option value="monospace">Monospace</option>
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

          <section className={`rounded-xl border border-white/10 bg-zinc-900 p-4 ${mobileInspectorTab === "section" ? "block" : "hidden lg:block"}`}>
            {selectedBlock ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold capitalize">{selectedBlock.type} settings</h2>
                  <button onClick={removeSelected} className="text-xs text-red-300 hover:text-red-200">{selectedBlock.locked ? "🔒 Locked" : "Remove"}</button>
                </div>

                {selectedBlock.type === "header" ? (
                  <>
                    <label className="mb-3 block"><span className={smallLabel}>Display name</span><input value={identity.name} onChange={(event) => setIdentity((current) => ({ ...current, name: event.target.value }))} className={fieldClass} /></label>
                    <label className="mb-2 block"><span className={smallLabel}>Avatar URL</span><input value={identity.avatar_url} onChange={(event) => setIdentity((current) => ({ ...current, avatar_url: event.target.value }))} className={fieldClass} /></label>
                    <label className="mb-3 block"><span className={smallLabel}>Banner URL</span><input value={identity.banner_url} onChange={(event) => setIdentity((current) => ({ ...current, banner_url: event.target.value }))} className={fieldClass} /></label>
                  </>
                ) : null}

                {selectedBlock.type === "about" ? (
                  <label className="mb-3 block"><span className={smallLabel}>About text</span><textarea rows={5} maxLength={400} value={identity.bio} onChange={(event) => setIdentity((current) => ({ ...current, bio: event.target.value }))} className={`${fieldClass} resize-y`} /></label>
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

                {selectedBlock.type === "gallery" ? (
                  <label className="mb-3 block"><span className={smallLabel}>Image URLs, one per line</span><textarea rows={4} value={((selectedBlock.config.images as string[]) ?? []).join("\n")} onChange={(event) => setConfig(selectedBlock.id, "images", event.target.value.split("\n").map((url) => url.trim()).filter(Boolean))} className={`${fieldClass} resize-y`} placeholder="https://image-url" /></label>
                ) : null}

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
        </aside>
      </div>
    </main>
  );
}