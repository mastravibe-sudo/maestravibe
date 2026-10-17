// path: maestra-vibe/components/PostComposer.tsx  (NEW file)
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, MapPin, Scissors, Smile, Type, Video, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MEDIA_LIMITS, compressImage, readVideoMeta, type VideoMeta } from "@/lib/media/compress";
import { EMOJIS } from "@/lib/stickers";
import { typeMeta } from "@/components/postMeta";
import type { Media } from "@/components/PostViewer";
import type { PostType } from "@/lib/posts";

const FILTERS = [
  { id: "none", name: "Original", css: "none" },
  { id: "vivid", name: "Vivid", css: "saturate(1.45) contrast(1.1)" },
  { id: "warm", name: "Warm", css: "sepia(0.25) saturate(1.3) hue-rotate(-10deg)" },
  { id: "cool", name: "Cool", css: "saturate(1.1) hue-rotate(15deg) brightness(1.05)" },
  { id: "bw", name: "B&W", css: "grayscale(1) contrast(1.1)" },
  { id: "fade", name: "Fade", css: "contrast(0.9) brightness(1.1) saturate(0.8)" },
  { id: "drama", name: "Drama", css: "contrast(1.3) brightness(0.9) saturate(1.1)" },
  { id: "vintage", name: "Vintage", css: "sepia(0.5) contrast(1.1) brightness(0.95)" },
  { id: "sunset", name: "Sunset", css: "sepia(0.3) saturate(1.6) hue-rotate(-20deg)" },
];
const ASPECTS = [{ id: "original", name: "Original", r: 0 }, { id: "1:1", name: "1:1", r: 1 }, { id: "4:5", name: "4:5", r: 0.8 }, { id: "16:9", name: "16:9", r: 16 / 9 }];
const MAX_SOURCE_BYTES = 300 * 1024 * 1024;
const input = "w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-500";

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Choose a valid image."));
    i.src = url;
  });
}

async function renderImage(file: File, filterCss: string, ratio: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const r = ratio || img.width / img.height;
    let sw = img.width, sh = img.height;
    if (sw / sh > r) sw = sh * r; else sh = sw / r;
    const k = Math.min(1, MEDIA_LIMITS.imageMaxEdge / Math.max(sw, sh));
    const c = document.createElement("canvas");
    c.width = Math.round(sw * k);
    c.height = Math.round(sh * k);
    const ctx = c.getContext("2d")!;
    if (filterCss !== "none") ctx.filter = filterCss;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not prepare the image."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Video ka chuna hua 30 second ka hissa chhoti size mein dobara record karta hai (real time mein chalta hai)
async function recordClip(file: File, start: number, filterCss: string, onProgress: (p: number) => void): Promise<Blob> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.src = url;
  v.playsInline = true;
  v.preload = "auto";
  await new Promise<void>((res, rej) => { v.onloadeddata = () => res(); v.onerror = () => rej(new Error("This video could not be read.")); });
  const len = Math.min(MEDIA_LIMITS.videoMaxSeconds, v.duration - start);
 const k = Math.min(1, 720 / Math.min(v.videoWidth, v.videoHeight));
  const w = Math.round((v.videoWidth * k) / 2) * 2, h = Math.round((v.videoHeight * k) / 2) * 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  if (filterCss !== "none") ctx.filter = filterCss;
  const stream = canvas.captureStream(24);
  const ac = new AudioContext();
  const dest = ac.createMediaStreamDestination();
  ac.createMediaElementSource(v).connect(dest);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));

const mime = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
].find((m) => MediaRecorder.isTypeSupported(m));


  if (!mime) throw new Error("This browser cannot prepare videos. Please use an updated Chrome, Edge, Firefox or Safari.");
const targetTotalBps = Math.floor(
  (MEDIA_LIMITS.videoMaxBytes * 0.92 * 8) / Math.max(len, 1)
);

const audioBps = Math.min(
  96_000,
  Math.max(48_000, Math.floor(targetTotalBps * 0.12))
);

const videoBps = Math.max(300_000, targetTotalBps - audioBps);

const rec = new MediaRecorder(stream, {
  mimeType: mime,
  videoBitsPerSecond: videoBps,
  audioBitsPerSecond: audioBps,
});
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const seeked = new Promise<void>((res) => { v.onseeked = () => res(); });
  v.currentTime = start;
  await seeked;
  await ac.resume();
  rec.start(1000);
  await v.play();
  let raf = 0;
  const draw = () => { ctx.drawImage(v, 0, 0, w, h); onProgress(Math.min(1, (v.currentTime - start) / len)); raf = requestAnimationFrame(draw); };
  draw();
  await new Promise<void>((res) => { const t = setInterval(() => { if (v.currentTime - start >= len || v.ended) { clearInterval(t); res(); } }, 200); });
  cancelAnimationFrame(raf);
  v.pause();
  await new Promise<void>((res) => { rec.onstop = () => res(); rec.stop(); });
  void ac.close();
  URL.revokeObjectURL(url);
  return new Blob(chunks, { type: mime.split(";")[0] });
}

async function upload(blob: Blob, purpose: "post" | "post-video", name: string) {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", blob, name);
  const r = await fetch("/api/upload", { method: "POST", body: form });
  const out = (await r.json()) as { publicUrl?: string; error?: string };
  if (!r.ok || !out.publicUrl) throw new Error(out.error ?? "Upload failed.");
  return out.publicUrl;
}

export default function PostComposer({ me, onClose, onPublished }: { me: string; onClose: () => void; onPublished: () => void }) {
  const [step, setStep] = useState<"media" | "edit" | "details">("media");
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<"image" | "video" | null>(null);
  const [preview, setPreview] = useState("");
  const [vmeta, setVmeta] = useState<VideoMeta | null>(null);
  const [filterId, setFilterId] = useState("none");
  const [aspect, setAspect] = useState("original");
  const [start, setStart] = useState(0);
  const [type, setType] = useState<PostType>("vibe");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [tagsText, setTagsText] = useState("");
  const [location, setLocation] = useState("");
  const [commentPolicy, setCommentPolicy] = useState("everyone");
  const [sharePolicy, setSharePolicy] = useState("everyone");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);

  const filterCss = FILTERS.find((f) => f.id === filterId)?.css ?? "none";
  const ratio = ASPECTS.find((a) => a.id === aspect)?.r ?? 0;
  const canFilter = typeof window !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (videoRef.current && step === "edit") videoRef.current.currentTime = start; }, [start, step]);

  const pick = async (f: File | undefined, want: "image" | "video") => {
    if (!f) return;
    setError("");
    try {
      if (want === "image" && !f.type.startsWith("image/")) throw new Error("Choose a photo (JPG, PNG or WebP).");
      if (want === "video") {
        if (!f.type.startsWith("video/")) throw new Error("Choose a video file.");
        if (f.size > MAX_SOURCE_BYTES) throw new Error("This video is too large to prepare (300 MB max).");
        setVmeta(await readVideoMeta(f));
      }
      setFile(f);
      setKind(want);
      setStart(0);
      setPreview(URL.createObjectURL(f));
      setStep("edit");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const publish = async () => {
    setBusy(true);
    setError("");
    setProgress(0);
    try {
      let media: Media[] = [];
      if (file && kind === "image") {
        setStatus("Optimising your photo...");
        const blob = await compressImage(await renderImage(file, canFilter ? filterCss : "none", ratio));
        media = [{ type: "image", url: await upload(blob, "post", "photo.webp"), bytes: blob.size }];
      } else if (file && kind === "video") {
        setStatus("Preparing your clip. Keep this tab open.");
        const clip = await recordClip(file, start, canFilter ? filterCss : "none", setProgress);
if (clip.size > MEDIA_LIMITS.videoMaxBytes) {
  throw new Error(
    `This clip is ${(clip.size / 1048576).toFixed(1)} MB. Maximum size is 2.5 MB. Try a shorter clip.`
  );
}
        setStatus("Uploading...");
        media = [{ type: "video", url: await upload(clip, "post-video", `clip.${clip.type.includes("mp4") ? "mp4" : "webm"}`), bytes: clip.size, width: vmeta?.width, height: vmeta?.height }];
      }
      if (!media.length && !body.trim() && !title.trim()) throw new Error("Add a photo, a video or some text first.");
      setStatus("Publishing...");
      const tags = tagsText.split(/[\s,#]+/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 10);
      const { error: dbError } = await createClient().from("posts").insert({
        user_id: me, type, title: title.trim() || null, body: body.trim(), tags, location: location.trim() || null, media,
        image_url: media[0]?.type === "image" ? media[0].url : null, comment_policy: commentPolicy, share_policy: sharePolicy,
      });
      if (dbError) throw dbError;
      onPublished();
    } catch (e) {
      const m = (e as { message?: string })?.message ?? "Something went wrong.";
      setError(/column|schema cache/i.test(m) ? "Database update needed: run supabase/migrations/post_settings.sql in Supabase." : m);
    }
    setBusy(false);
  };

  const clipEnd = vmeta ? Math.min(vmeta.duration, start + MEDIA_LIMITS.videoMaxSeconds) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Create post">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-zinc-900 text-zinc-100 shadow-2xl sm:rounded-2xl">
        <header className="flex items-center gap-2 border-b border-white/10 p-3">
          {step !== "media" ? <button onClick={() => setStep(step === "details" ? (file ? "edit" : "media") : "media")} aria-label="Back" className="rounded-full p-2 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button> : null}
          <h2 className="flex-1 text-base font-semibold">{step === "media" ? "New post" : step === "edit" ? "Edit media" : "Details"}</h2>
          {step === "edit" ? <button onClick={() => setStep("details")} className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white">Next</button> : null}
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error ? <p role="alert" className="mb-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}

          {step === "media" ? (
            <div className="space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-4 hover:bg-white/5">
                <ImagePlus className="h-6 w-6 text-blue-400" /><span><span className="block font-medium">Photo</span><span className="text-xs text-zinc-400">Shrunk to under 70 KB automatically</span></span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0], "image")} />
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 p-4 hover:bg-white/5">
                <Video className="h-6 w-6 text-pink-400" /><span><span className="block font-medium">Video</span><span className="text-xs text-zinc-400">Any length. You pick the best 30 seconds.</span></span>
                <input type="file" accept="video/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0], "video")} />
              </label>
              <button onClick={() => { setFile(null); setKind(null); setStep("details"); }} className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-4 text-left hover:bg-white/5"><Type className="h-6 w-6 text-emerald-400" /><span className="font-medium">Text only</span></button>
              <a href="https://www.capcut.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200"><Scissors className="h-4 w-4" />Edit in CapCut first, then upload the exported file here.</a>
            </div>
          ) : null}

          {step === "edit" && file ? (
            <div className="space-y-4">
              {kind === "image" ? (
                <div className="mx-auto max-h-[46vh] w-full max-w-sm overflow-hidden rounded-xl bg-black" style={ratio ? { aspectRatio: String(ratio) } : undefined}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Preview" className={`h-full w-full ${ratio ? "object-cover" : "object-contain"}`} style={{ filter: canFilter ? filterCss : "none" }} />
                </div>
              ) : (
                <video ref={videoRef} src={preview} controls playsInline className="mx-auto max-h-[46vh] rounded-xl bg-black" style={{ filter: canFilter ? filterCss : "none" }} />
              )}

              {kind === "video" && vmeta ? (
                <div>
                  <p className="mb-1 text-sm">Clip: {Math.floor(start)}s to {Math.floor(clipEnd)}s <span className="text-zinc-400">(max 30 seconds)</span></p>
                  {vmeta.duration > MEDIA_LIMITS.videoMaxSeconds ? (
                    <input type="range" min={0} max={Math.max(0, vmeta.duration - MEDIA_LIMITS.videoMaxSeconds)} step={1} value={start} onChange={(e) => setStart(Number(e.target.value))} className="w-full accent-blue-500" aria-label="Clip start" />
                  ) : null}
                </div>
              ) : null}

              {kind === "image" ? (
                <div className="flex gap-2">
                  {ASPECTS.map((a) => <button key={a.id} onClick={() => setAspect(a.id)} className={`rounded-full px-3 py-1 text-sm ${aspect === a.id ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>{a.name}</button>)}
                </div>
              ) : null}

              {canFilter ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {FILTERS.map((f) => <button key={f.id} onClick={() => setFilterId(f.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${filterId === f.id ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>{f.name}</button>)}
                </div>
              ) : <p className="text-xs text-zinc-500">Filters need Chrome, Edge or Firefox.</p>}
            </div>
          ) : null}

          {step === "details" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(typeMeta) as PostType[]).map((k) => { const { Icon, label } = typeMeta[k]; return (
                  <button key={k} onClick={() => setType(k)} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${type === k ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300"}`}><Icon className="h-4 w-4" />{label}</button>
                ); })}
              </div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Title (optional)" className={input} />
              <div>
                <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4} placeholder="Write a caption..." className={input} />
                <button onClick={() => setEmoji(!emoji)} className="mt-1 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"><Smile className="h-4 w-4" />Emoji</button>
                {emoji ? <div className="mt-1 grid max-h-28 grid-cols-8 gap-1 overflow-y-auto rounded-lg bg-zinc-800 p-2 text-xl">{EMOJIS.map((e) => <button key={e} onClick={() => setBody((b) => b + e)} className="rounded hover:bg-white/10">{e}</button>)}</div> : null}
              </div>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="Tags: travel, dreams, startup (max 10)" className={input} />
              <div className="relative"><MapPin className="absolute left-3 top-3 h-4 w-4 text-zinc-500" /><input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={80} placeholder="Add location" className={`${input} pl-9`} /></div>
              <label className="block text-sm"><span className="mb-1 block text-zinc-400">Who can comment</span>
                <select value={commentPolicy} onChange={(e) => setCommentPolicy(e.target.value)} className={input}><option value="everyone">Everyone</option><option value="followers">Only my followers</option><option value="off">No one (comments off)</option></select></label>
              <label className="block text-sm"><span className="mb-1 block text-zinc-400">Who can repost and share</span>
                <select value={sharePolicy} onChange={(e) => setSharePolicy(e.target.value)} className={input}><option value="everyone">Everyone</option><option value="followers">Only my followers</option><option value="nobody">No one</option></select></label>
            </div>
          ) : null}
        </div>

        {step === "details" ? (
          <footer className="border-t border-white/10 p-3">
            {busy ? <div className="mb-2"><p className="text-xs text-zinc-400">{status}</p>{kind === "video" ? <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div> : null}</div> : null}
            <button onClick={() => void publish()} disabled={busy} className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{busy ? "Please wait..." : "Share post"}</button>
          </footer>
        ) : null}
      </div>
    </div>
  );
}