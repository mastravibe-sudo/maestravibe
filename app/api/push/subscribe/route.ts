import { createClient } from "@/lib/supabase/server";

type PushKeys = { p256dh?: string; auth?: string };
type PushSubscriptionInput = { endpoint?: string; keys?: PushKeys };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in to enable notifications." }, { status: 401 });

  let subscription: PushSubscriptionInput;
  try {
    subscription = await request.json();
  } catch {
    return Response.json({ error: "Invalid push subscription." }, { status: 400 });
  }

  const endpoint = subscription.endpoint;
  const p256dh = subscription.keys?.p256dh;
  const auth = subscription.keys?.auth;
  if (!endpoint || !p256dh || !auth || !endpoint.startsWith("https://")) {
    return Response.json({ error: "The browser returned an incomplete push subscription." }, { status: 400 });
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth, updated_at: new Date().toISOString() },
    { onConflict: "endpoint" }
  );
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ enabled: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in to manage notifications." }, { status: 401 });

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid unsubscribe request." }, { status: 400 });
  }
  if (!body.endpoint) return Response.json({ error: "Missing subscription endpoint." }, { status: 400 });

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", body.endpoint);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ enabled: false });
}
