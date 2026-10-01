// path: maestra-vibe/app/api/upload/route.ts  (NEW file, app/api/upload folder banao)
// Logged-in user ko R2 mein photo upload karne ka temporary link deta hai
import { createClient } from "@/lib/supabase/server";
import { presignUpload, publicUrl, uploadObject } from "@/lib/r2";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });

  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return Response.json({ error: "Invalid image upload." }, { status: 400 });
    }

    const purpose = formData.get("purpose");
    const imageType = formData.get("imageType");
    const file = formData.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "Choose an image to upload." }, { status: 400 });
    }
    if (file.type !== "image/webp") {
      return Response.json({ error: "Only compressed WebP images are allowed." }, { status: 400 });
    }

    const isProfileImage = purpose === "profile" && (imageType === "avatar" || imageType === "banner");
    const isPostImage = purpose === "post";
    if (!isProfileImage && !isPostImage) {
      return Response.json({ error: "Invalid upload purpose." }, { status: 400 });
    }

    const maxBytes = isProfileImage ? 100 * 1024 : 10 * 1024 * 1024;
    if (file.size === 0 || file.size > maxBytes) {
      return Response.json(
        { error: isProfileImage ? "Profile images must be no larger than 100 KB." : "Post images must be no larger than 10 MB." },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const isWebp = bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (!isWebp) return Response.json({ error: "The uploaded file is not a valid WebP image." }, { status: 400 });

    const key = isProfileImage
      ? `profiles/${user.id}/${imageType}/${crypto.randomUUID()}.webp`
      : `posts/${user.id}/${crypto.randomUUID()}.webp`;
    try {
      await uploadObject(key, "image/webp", bytes);
      return Response.json({ publicUrl: publicUrl(key) });
    } catch {
      return Response.json({ error: "Could not store the image. Check the R2 server configuration." }, { status: 502 });
    }
  }

  let body: { contentType?: string; purpose?: string; imageType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  }

  const { contentType, purpose = "post", imageType } = body;
  if (contentType !== "image/webp") {
    return Response.json({ error: "Only WebP images are allowed." }, { status: 400 });
  }

  let key: string;
  if (purpose === "post") {
    key = `posts/${user.id}/${crypto.randomUUID()}.webp`;
  } else if (purpose === "profile" && (imageType === "avatar" || imageType === "banner")) {
    key = `profiles/${user.id}/${imageType}/${crypto.randomUUID()}.webp`;
  } else {
    return Response.json({ error: "Invalid upload purpose." }, { status: 400 });
  }

  try {
    return Response.json({
      uploadUrl: await presignUpload(key, contentType),
      publicUrl: publicUrl(key),
    });
  } catch {
    return Response.json({ error: "Could not prepare the image upload. Check the R2 server configuration." }, { status: 500 });
  }
}