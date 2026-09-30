// path: maestra-vibe/app/api/upload/route.ts  (NEW file, app/api/upload folder banao)
// Logged-in user ko R2 mein photo upload karne ka temporary link deta hai
import { createClient } from "@/lib/supabase/server";
import { presignUpload, publicUrl } from "@/lib/r2";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Please log in first." }, { status: 401 });

  const { contentType } = await req.json();
  if (contentType !== "image/webp") {
    return Response.json({ error: "Only WebP images are allowed." }, { status: 400 });
  }

  const key = `posts/${user.id}/${crypto.randomUUID()}.webp`;
  return Response.json({
    uploadUrl: await presignUpload(key, contentType),
    publicUrl: publicUrl(key),
  });
}