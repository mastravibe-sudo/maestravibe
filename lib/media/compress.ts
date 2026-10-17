// path: maestra-vibe/lib/media/compress.ts  (NEW file, lib ke andar media folder banao)
// Photos browser mein hi 70 KB ke andar compress hoti hain, server par koi load nahi.

export const MEDIA_LIMITS = {
  imageMaxBytes: 70 * 1024,
  imageMaxEdge: 1080,
  videoMaxSeconds: 30, // har video 30 second tak
videoMaxBytes: 2.5 * 1024 * 1024,
} as const;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Choose a valid image (JPG, PNG or WebP)."));
    img.src = src;
  });
}

/** Kisi bhi image (ya filter lagi hui canvas image) ko WebP mein 70 KB ke andar karta hai. */
export async function compressImage(
  file: Blob,
  maxBytes: number = MEDIA_LIMITS.imageMaxBytes,
  maxEdge: number = MEDIA_LIMITS.imageMaxEdge
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser could not prepare this image.");

    let scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    let smallest = Infinity;
    while (scale >= 0.2) {
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
        if (!blob || blob.type !== "image/webp") {
          throw new Error("This browser cannot create WebP images. Please use an updated Chrome, Edge or Firefox.");
        }
        smallest = Math.min(smallest, blob.size);
        if (blob.size <= maxBytes) return blob;
      }
      scale *= 0.85;
    }
    throw new Error(`Could not shrink this image below ${Math.round(maxBytes / 1024)} KB (smallest: ${Math.ceil(smallest / 1024)} KB).`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type VideoMeta = { duration: number; width: number; height: number };

export function readVideoMeta(file: Blob): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This video could not be read."));
    };
    video.src = url;
  });
}

/** Video ki type aur lambai check karta hai (re-encode / compress baad ke stage mein). */
export async function validateVideo(file: File): Promise<VideoMeta> {
  if (!file.type.startsWith("video/")) throw new Error("Choose a video file.");
  const meta = await readVideoMeta(file);
  if (meta.duration > MEDIA_LIMITS.videoMaxSeconds) {
    const minutes = Math.floor(meta.duration / 60);
    const seconds = Math.round(meta.duration % 60);
    throw new Error(`Videos can be up to 30 seconds. This one is ${minutes} min ${seconds} sec.`);
  }
  return meta;
}