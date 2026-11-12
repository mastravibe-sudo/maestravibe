// path: maestra-vibe/app/api/upload/route.ts  (poori file replace karo)
// Logged-in user ki photo/video R2 mein rakhta hai. Size aur file ki asli pehchan server par check hoti hai.
import { createClient } from "@/lib/supabase/server";
import { publicUrl, uploadObject } from "@/lib/r2";

const LIMITS = {
  profile: 100 * 1024,
  post: 150 * 1024,
  video: 2.5 * 1024 * 1024,
  statusImage: 150 * 1024,
  statusMusic: 10 * 1024 * 1024,
  chatImage: 150 * 1024,
  chatVoice: 1024 * 1024,
};
const at = (b: Uint8Array, offset: number, sig: number[]) => sig.every((v, i) => b[offset + i] === v);
const isWebp = (b: Uint8Array) => b.length >= 12 && at(b, 0, [0x52, 0x49, 0x46, 0x46]) && at(b, 8, [0x57, 0x45, 0x42, 0x50]);
const isMp4 = (b: Uint8Array) => b.length >= 12 && at(b, 4, [0x66, 0x74, 0x79, 0x70]);
const isWebm = (b: Uint8Array) => b.length >= 4 && at(b, 0, [0x1a, 0x45, 0xdf, 0xa3]);

function mp3DurationSeconds(bytes: Uint8Array) {
  let offset = 0;
  if (bytes.length >= 10 && at(bytes, 0, [0x49, 0x44, 0x33])) {
    const tagSize = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
    offset = 10 + tagSize + ((bytes[5] & 0x10) ? 10 : 0);
  }

  const mpeg1Layer3Bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
  const mpeg2Layer3Bitrates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
  const sampleRates = [44100, 48000, 32000];
  let frameCount = 0;
  let duration = 0;
  let cursor = offset;

  while (cursor + 4 <= bytes.length) {
    const header = (bytes[cursor] << 24) | (bytes[cursor + 1] << 16) | (bytes[cursor + 2] << 8) | bytes[cursor + 3];
    if ((header >>> 21) !== 0x7ff) {
      cursor++;
      continue;
    }
    const version = (header >>> 19) & 0x3;
    const layer = (header >>> 17) & 0x3;
    const bitrateIndex = (header >>> 12) & 0xf;
    const sampleRateIndex = (header >>> 10) & 0x3;
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      cursor++;
      continue;
    }

    const mpeg1 = version === 3;
    const bitrate = (mpeg1 ? mpeg1Layer3Bitrates : mpeg2Layer3Bitrates)[bitrateIndex] * 1000;
    const sampleRate = sampleRates[sampleRateIndex] / (version === 2 ? 2 : version === 0 ? 4 : 1);
    const padding = (header >>> 9) & 1;
    const frameLength = Math.floor((mpeg1 ? 144 : 72) * bitrate / sampleRate) + padding;
    if (frameLength < 24 || cursor + frameLength > bytes.length) {
      cursor++;
      continue;
    }

    frameCount++;
    duration += (mpeg1 ? 1152 : 576) / sampleRate;
    cursor += frameLength;
    if (frameCount > 30000) return null;
  }

  return frameCount > 0 ? duration : null;
}

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
  const isProfileBackgroundVideo = purpose === "profile-background-video";
  const isProfileBackgroundImage = purpose === "profile-background-image";
  const isStatusImage = purpose === "status-image";
  const isStatusMusic = purpose === "status-music";
  const isChatImage = purpose === "chat-image";
  const isChatVoice = purpose === "chat-voice";
  if (!isProfile && !isPostImage && !isPostVideo && !isProfileBackgroundVideo && !isProfileBackgroundImage && !isStatusImage && !isStatusMusic && !isChatImage && !isChatVoice) {
    return Response.json({ error: "Invalid upload purpose." }, { status: 400 });
  }

  const max = isProfile ? LIMITS.profile
    : isPostImage ? LIMITS.post
      : (isPostVideo || isProfileBackgroundVideo) ? LIMITS.video
      : isProfileBackgroundImage ? LIMITS.profile
        : isStatusImage ? LIMITS.statusImage
          : isStatusMusic ? LIMITS.statusMusic
            : isChatImage ? LIMITS.chatImage
              : LIMITS.chatVoice;
  if (file.size === 0 || file.size > max) {
    const label = (isPostVideo || isProfileBackgroundVideo) ? "Videos must be 30 seconds and 2.5 MB or less."
      : isStatusMusic ? "Status music must be an MP3 file of 10 MB or less."
        : isChatVoice ? "Voice messages must be 2 minutes and 1 MB or less."
          : `Images must be ${Math.round(max / 1024)} KB or less.`;
    return Response.json({ error: label }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  let ext: "webp" | "mp4" | "webm" | "mp3";
  let contentType: string;
  if (isStatusMusic) {
    const hasMp3Signature = at(bytes, 0, [0x49, 0x44, 0x33]) || bytes.some((byte, index) =>
      index + 1 < bytes.length && byte === 0xff && (bytes[index + 1] & 0xe0) === 0xe0
    );
    if (!hasMp3Signature) return Response.json({ error: "Choose a valid MP3 audio file." }, { status: 400 });
    const duration = mp3DurationSeconds(bytes);
    if (duration === null) return Response.json({ error: "Could not read the MP3 duration." }, { status: 400 });
    if (duration > 30) return Response.json({ error: "Status music clips must be 30 seconds or shorter." }, { status: 413 });
    [ext, contentType] = ["mp3", "audio/mpeg"];
  } else if (isPostVideo || isProfileBackgroundVideo) {
    if (isMp4(bytes)) [ext, contentType] = ["mp4", "video/mp4"];
    else if (isWebm(bytes)) [ext, contentType] = ["webm", "video/webm"];
    else return Response.json({ error: "Only MP4 or WebM videos are allowed." }, { status: 400 });
  } else if (isChatVoice) {
    if (!isWebm(bytes)) return Response.json({ error: "Voice messages must use WebM/Opus audio." }, { status: 400 });
    [ext, contentType] = ["webm", "audio/webm"];
  } else {
    if (!isWebp(bytes)) return Response.json({ error: "Only compressed WebP images are allowed." }, { status: 400 });
    [ext, contentType] = ["webp", "image/webp"];
  }

  const key = isProfile
    ? `profiles/${user.id}/${imageType}/${crypto.randomUUID()}.${ext}`
    : isProfileBackgroundVideo
      ? `profiles/${user.id}/background/${crypto.randomUUID()}.${ext}`
      : isProfileBackgroundImage
        ? `profiles/${user.id}/background/${crypto.randomUUID()}.${ext}`
      : isChatImage || isChatVoice
        ? `chat-media/${user.id}/${crypto.randomUUID()}.${ext}`
        : `posts/${user.id}/${crypto.randomUUID()}.${ext}`;
  try {
    await uploadObject(key, contentType, bytes);
    return Response.json({ publicUrl: publicUrl(key) });
  } catch {
    return Response.json({ error: "Could not store the file. Check the R2 server configuration." }, { status: 502 });
  }
}