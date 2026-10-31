// path: maestra-vibe/app/api/upload/route.ts  (poori file replace karo)
// Logged-in user ki photo/video R2 mein rakhta hai. Size aur file ki asli pehchan server par check hoti hai.
import { createClient } from "@/lib/supabase/server";
import { publicUrl, uploadObject } from "@/lib/r2";

const LIMITS = {
  profile: 100 * 1024,
  post: 150 * 1024,
  video: 2.5 * 1024 * 1024,
};
const at = (b: Uint8Array, offset: number, sig: number[]) => sig.every((v, i) => b[offset + i] === v);
const isWebp = (b: Uint8Array) => b.length >= 12 && at(b, 0, [0x52, 0x49, 0x46, 0x46]) && at(b, 8, [0x57, 0x45, 0x42, 0x50]);
const isMp4 = (b: Uint8Array) => b.length >= 12 && at(b, 4, [0x66, 0x74, 0x79, 0x70]);
const isWebm = (b: Uint8Array) => b.length >= 4 && at(b, 0, [0x1a, 0x45, 0xdf, 0xa3]);

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid upload." }, { status: 400 });
  }

  const purpose = form.get("purpose");
  const imageType = form.get("imageType");
  const file = form.get("file");
  if (!file || typeof file === "string") return Response.json({ error: "Choose a file to upload." }, { status: 400 });

  const isProfile = purpose === "profile" && (imageType === "avatar" || imageType === "banner");
  const isPostImage = purpose === "post";
  const isPostVideo = purpose === "post-video";
  if (!isProfile && !isPostImage && !isPostVideo) return Response.json({ error: "Invalid upload purpose." }, { status: 400 });

  const max = isProfile ? LIMITS.profile : isPostImage ? LIMITS.post : LIMITS.video;
  if (file.size === 0 || file.size > max) {
    const label = isPostVideo ? "Videos must be 30 seconds and 2.5 MB or less." : `Images must be ${Math.round(max / 1024)} KB or less.`;
    return Response.json({ error: label }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let ext: "webp" | "mp4" | "webm";
  let contentType: string;
  if (isPostVideo) {
    if (isMp4(bytes)) [ext, contentType] = ["mp4", "video/mp4"];
    else if (isWebm(bytes)) [ext, contentType] = ["webm", "video/webm"];
    else return Response.json({ error: "Only MP4 or WebM videos are allowed." }, { status: 400 });
  } else {
    if (!isWebp(bytes)) return Response.json({ error: "Only compressed WebP images are allowed." }, { status: 400 });
    [ext, contentType] = ["webp", "image/webp"];
  }

  const key = isProfile
    ? `profiles/${user.id}/${imageType}/${crypto.randomUUID()}.${ext}`
    : `posts/${user.id}/${crypto.randomUUID()}.${ext}`;
  try {
    await uploadObject(key, contentType, bytes);
    return Response.json({ publicUrl: publicUrl(key) });
  } catch {
    return Response.json({ error: "Could not store the file. Check the R2 server configuration." }, { status: 502 });
  }
}