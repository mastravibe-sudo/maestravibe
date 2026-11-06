import { createClient } from "@/lib/supabase/server";
import { chatMediaObjectKey, deleteObject } from "@/lib/r2";

type MediaDeliveryResult = { image_url: string | null; voice_url: string | null };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "Please log in first." }, { status: 401 });

  let messageId: unknown;
  try {
    ({ messageId } = await request.json() as { messageId?: unknown });
  } catch {
    return Response.json({ error: "Invalid media delivery request." }, { status: 400 });
  }
  if (typeof messageId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId)) {
    return Response.json({ error: "Invalid message id." }, { status: 400 });
  }

  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("sender_id,image_url,voice_url")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError) return Response.json({ error: "Could not verify this chat message." }, { status: 500 });
  if (!message) return Response.json({ error: "Message not found." }, { status: 404 });
  if (message.sender_id === user.id) return Response.json({ error: "Only the recipient can confirm delivery." }, { status: 403 });
  const keys = [message.image_url, message.voice_url]
    .filter((url): url is string => !!url)
    .map(chatMediaObjectKey);
  if (keys.some((key) => key === null)) {
    return Response.json({ error: "Chat media URL is not stored in the private chat-media area." }, { status: 400 });
  }

  const { data, error: deliveryError } = await supabase.rpc("mark_chat_media_delivered", { p_message_id: messageId });
  if (deliveryError) return Response.json({ error: "Could not mark chat media as delivered." }, { status: 500 });
  const delivered = (Array.isArray(data) ? data[0] : data) as MediaDeliveryResult | null;
  if (!delivered) return Response.json({ error: "This conversation is not available to you." }, { status: 403 });

  try {
    await Promise.all(keys.filter((key): key is string => key !== null).map(deleteObject));
  } catch {
    return Response.json({ error: "Media was delivered, but its temporary server copy could not be deleted." }, { status: 502 });
  }
  return Response.json({ ok: true });
}
