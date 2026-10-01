import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

type SubscriptionRow = { endpoint: string; p256dh: string; auth: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in as an administrator." }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_role,account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.account_role !== "admin" || profile.account_status !== "approved") {
    return Response.json({ error: "Admin access required." }, { status: 403 });
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT;
  if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return Response.json({ error: "Push delivery is not configured. Add the VAPID values to the server environment." }, { status: 503 });
  }

  let body: { announcementId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid announcement request." }, { status: 400 });
  }
  if (!body.announcementId) return Response.json({ error: "Missing announcement ID." }, { status: 400 });

  const { data: announcement, error: announcementError } = await supabase
    .from("app_announcements")
    .select("id,title,body")
    .eq("id", body.announcementId)
    .maybeSingle();
  if (announcementError || !announcement) {
    return Response.json({ error: announcementError?.message ?? "Announcement not found." }, { status: 404 });
  }

  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth");
  if (subscriptionsError) return Response.json({ error: subscriptionsError.message }, { status: 500 });

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const notification = JSON.stringify({
    title: announcement.title,
    body: announcement.body.slice(0, 180),
    url: `/notifications?announcement=${announcement.id}`,
    tag: `announcement-${announcement.id}`,
  });
  const results = await Promise.allSettled(((subscriptions ?? []) as SubscriptionRow[]).map((subscription) =>
    webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      notification,
      { TTL: 300 }
    )
  ));

  const expiredEndpoints = results.flatMap((result, index) => {
    if (result.status === "rejected" && [404, 410].includes(Number(result.reason?.statusCode))) {
      return [(subscriptions ?? [])[index].endpoint];
    }
    return [];
  });

  if (expiredEndpoints.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
  }

  const sent = results.filter((result) => result.status === "fulfilled").length;
  return Response.json({ sent, failed: results.length - sent, total: results.length });
}
