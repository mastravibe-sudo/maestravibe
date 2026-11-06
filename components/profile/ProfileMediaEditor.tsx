"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, X } from "lucide-react";

type ProfileMediaEditorProps = {
  file: File;
  imageType: "avatar" | "banner";
  saving: boolean;
  onClose: () => void;
  onSave: (image: Blob) => Promise<void>;
};

function createPreview(file: File) {
  return URL.createObjectURL(file);
}

async function loadImage(url: string) {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

async function loadVideo(url: string) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  await new Promise<void>((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error("This video could not be previewed."));
    video.src = url;
  });
  return video;
}

async function compressSquare(file: File, url: string, horizontal: number, vertical: number, frameTime: number) {
  const source = file.type.startsWith("video/") ? await loadVideo(url) : await loadImage(url);
  if (file.type.startsWith("video/")) {
    const video = source as HTMLVideoElement;
    const selectedTime = Math.min(frameTime, Math.max(0, video.duration - 0.05));
    if (Math.abs(video.currentTime - selectedTime) > 0.01) {
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new Error("Could not select this video frame."));
        video.currentTime = selectedTime;
      });
    }
  }
  const width = file.type.startsWith("video/") ? (source as HTMLVideoElement).videoWidth : (source as HTMLImageElement).naturalWidth;
  const height = file.type.startsWith("video/") ? (source as HTMLVideoElement).videoHeight : (source as HTMLImageElement).naturalHeight;
  if (!width || !height) throw new Error("This file has no usable image frame.");

  const cropSize = Math.min(width, height);
  const sourceX = (width - cropSize) * horizontal / 100;
  const sourceY = (height - cropSize) * vertical / 100;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not prepare this image.");

  let scale = Math.min(1, 1200 / cropSize);
  let smallest = Infinity;
  while (scale >= 0.12) {
    const edge = Math.max(1, Math.round(cropSize * scale));
    canvas.width = edge;
    canvas.height = edge;
    context.clearRect(0, 0, edge, edge);
    context.drawImage(source, sourceX, sourceY, cropSize, cropSize, 0, 0, edge, edge);
    for (const quality of [0.82, 0.72, 0.62, 0.52, 0.42, 0.32, 0.22]) {
      const image = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!image || image.type !== "image/webp") throw new Error("This browser cannot create WebP images.");
      smallest = Math.min(smallest, image.size);
      if (image.size <= 100 * 1024) return image;
    }
    scale *= 0.8;
  }
  throw new Error(`Could not compress this crop below 100 KB (smallest: ${Math.ceil(smallest / 1024)} KB).`);
}

export default function ProfileMediaEditor({ file, imageType, saving, onClose, onSave }: ProfileMediaEditorProps) {
  const previewUrl = useMemo(() => createPreview(file), [file]);
  const [horizontal, setHorizontal] = useState(50);
  const [vertical, setVertical] = useState(50);
  const [frameTime, setFrameTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const save = async () => {
    setError(null);
    try {
      const image = await compressSquare(file, previewUrl, horizontal, vertical, frameTime);
      await onSave(image);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not prepare this image.");
    }
  };

  const video = file.type.startsWith("video/");

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="profile-media-title" className="max-h-[94dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-white/10 bg-[#100d24] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white shadow-2xl sm:rounded-3xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">Profile photo</p>
            <h2 id="profile-media-title" className="mt-1 text-xl font-bold">Crop {imageType === "avatar" ? "avatar" : "cover"} square</h2>
          </div>
          <button type="button" disabled={saving} onClick={onClose} aria-label="Close crop editor" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-2xl border border-white/15 bg-black">
          {video ? (
            <video
              src={previewUrl}
              controls
              playsInline
              onTimeUpdate={(event) => setFrameTime(event.currentTarget.currentTime)}
              className="h-full w-full object-cover"
              style={{ objectPosition: `${horizontal}% ${vertical}%` }}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Profile image crop preview" className="h-full w-full object-cover" style={{ objectPosition: `${horizontal}% ${vertical}%` }} />
          )}
        </div>
        <p className="mt-3 text-center text-xs text-white/60">{video ? "Choose a frame, then adjust the square crop." : "Adjust the square crop before saving."}</p>
        <label className="mt-4 block space-y-1.5 text-xs text-white/75">
          <span>Horizontal crop</span>
          <input type="range" min="0" max="100" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} className="w-full accent-violet-400" />
        </label>
        <label className="mt-3 block space-y-1.5 text-xs text-white/75">
          <span>Vertical crop</span>
          <input type="range" min="0" max="100" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} className="w-full accent-violet-400" />
        </label>
        {error ? <p role="alert" className="mt-3 rounded-xl border border-pink-400/20 bg-pink-400/10 p-3 text-sm text-pink-100">{error}</p> : null}
        <button type="button" disabled={saving} onClick={() => void save()} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-blue-600 px-4 text-sm font-bold text-white disabled:opacity-50">
          <Camera className="h-4 w-4" /> {saving ? "Uploading..." : "Use this crop"}
        </button>
      </section>
    </div>
  );
}
