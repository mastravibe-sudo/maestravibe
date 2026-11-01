import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string };
export type PushPayload = { title: string; body: string; url: string; tag: string };

export async function sendPushNotifications(
  supabase: SupabaseClient,
  subscriptions: PushSubscriptionRow[],
  payload: PushPayload
) {
  if (!subscriptions.length) return { sent: 0, failed: 0, total: 0 };

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error("Push delivery is not configured.");
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  const message = JSON.stringify(payload);
  const results = await Promise.allSettled(subscriptions.map((subscription) =>
    webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      message,
      { TTL: 300 }
    )
  ));

  const expiredEndpoints = results.flatMap((result, index) => {
    if (result.status !== "rejected") return [];
    const statusCode = (result.reason as { statusCode?: number } | null)?.statusCode;
    return statusCode === 404 || statusCode === 410 ? [subscriptions[index].endpoint] : [];
  });
  if (expiredEndpoints.length) {
    const { error } = await supabase.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
    if (error) throw new Error("Could not remove expired push subscriptions.");
  }

  const sent = results.filter((result) => result.status === "fulfilled").length;
  return { sent, failed: results.length - sent, total: results.length };
}
