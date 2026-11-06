import { GetObjectCommand } from "@aws-sdk/client-s3";
import { chatMediaObjectKey, r2 } from "@/lib/r2";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  const { messageId } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
    return Response.json({ error: "Invalid message id." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please log in first." }, { status: 401 });

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("sender_id,image_url,voice_url")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError) return Response.json({ error: "Could not verify this chat message." }, { status: 500 });
  if (!message) return Response.json({ error: "Message not found." }, { status: 404 });

  const mediaUrl = message.voice_url ?? message.image_url;
  const key = mediaUrl ? chatMediaObjectKey(mediaUrl) : null;
  if (!key) return Response.json({ error: "This message has no temporary media available." }, { status: 404 });

  const bucket = process.env.R2_BUCKET;
  if (!bucket) return Response.json({ error: "Chat media storage is not configured." }, { status: 503 });
  try {
    const object = await r2.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!object.Body) return Response.json({ error: "Chat media is unavailable." }, { status: 404 });
    const bytes = await object.Body.transformToByteArray();
    const responseBody = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(responseBody).set(bytes);
    return new Response(responseBody, {
      headers: {
        "Content-Type": object.ContentType ?? (message.voice_url ? "audio/webm" : "image/webp"),
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(bytes.byteLength),
      },
    });
  } catch {
    return Response.json({ error: "Could not retrieve this chat media." }, { status: 502 });
  }
}
