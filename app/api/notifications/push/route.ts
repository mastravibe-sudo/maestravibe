import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushNotifications, type PushPayload } from "@/lib/notifications/push";

export const runtime = "nodejs";

type ActivityRequest =
  | { type: "vibe" | "comment"; postId: string }
  | { type: "follow"; profileId: string }
  | { type: "message"; messageId: string }
  | { type: "status"; statusId: string }
  | { type: "profile_view"; profileId: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in to send notifications." }, { status: 401 });
  const { data: actorProfile, error: actorProfileError } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (actorProfileError) return Response.json({ error: "Could not verify account access." }, { status: 500 });
  if (actorProfile?.account_status !== "approved") return Response.json({ error: "Approved account required." }, { status: 403 });

  let activity: ActivityRequest;
  try {
    activity = await request.json();
  } catch {
    return Response.json({ error: "Invalid notification request." }, { status: 400 });
  }
  if (!activity || typeof activity !== "object") {
    return Response.json({ error: "Invalid notification request." }, { status: 400 });
  }
  if ((activity.type === "vibe" || activity.type === "comment") && typeof activity.postId !== "string") {
    return Response.json({ error: "Missing post ID." }, { status: 400 });
  }
  if ((activity.type === "profile_view" || activity.type === "follow") && typeof activity.profileId !== "string") {
    return Response.json({ error: "Missing profile ID." }, { status: 400 });
  }
  if (activity.type === "message" && typeof activity.messageId !== "string") {
    return Response.json({ error: "Missing message ID." }, { status: 400 });
  }
  if (activity.type === "status" && typeof activity.statusId !== "string") {
    return Response.json({ error: "Missing status ID." }, { status: 400 });
  }
  if (!["vibe", "comment", "follow", "profile_view", "message", "status"].includes(activity.type)) {
    return Response.json({ error: "Unsupported notification type." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return Response.json({ error: "Server-side notification delivery is not configured." }, { status: 503 });
  }

  let notificationId: string | null = null;
  let messageConversationId: string | null = null;
  if (activity.type === "status") {
    const { data: status, error: statusError } = await admin
      .from("statuses")
      .select("id,user_id")
      .eq("id", activity.statusId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (statusError) return Response.json({ error: "Could not verify status activity." }, { status: 500 });
    if (!status) return Response.json({ sent: 0, skipped: true });

    const { data: follows, error: followsError } = await admin
      .from("follows")
      .select("follower_id")
      .eq("followed_id", user.id)
      .neq("follower_id", user.id);
    if (followsError) return Response.json({ error: "Could not load status followers." }, { status: 500 });

    const recipients = [...new Set((follows ?? []).map((follow) => follow.follower_id as string))];
    if (!recipients.length) return Response.json({ sent: 0, skipped: true });
    const { error: insertError } = await admin.from("notifications").upsert(
      recipients.map((recipientId) => ({
        recipient_id: recipientId,
        actor_id: user.id,
        type: "status",
        status_id: status.id,
      })),
      { onConflict: "recipient_id,status_id", ignoreDuplicates: true }
    );
    if (insertError) return Response.json({ error: "Could not create status notifications." }, { status: 500 });

    const { data: notifications, error: notificationsError } = await admin
      .from("notifications")
      .select("id,recipient_id,actor_id,status_id")
      .eq("status_id", status.id)
      .eq("actor_id", user.id)
      .is("push_sent_at", null);
    if (notificationsError) return Response.json({ error: "Could not load status notifications." }, { status: 500 });

    const { data: actor, error: actorError } = await admin.from("profiles").select("name,username").eq("id", user.id).maybeSingle();
    if (actorError) return Response.json({ error: "Could not load status sender." }, { status: 500 });
    let sent = 0;
    for (const notification of notifications ?? []) {
      const { data: subscriptions, error: subscriptionsError } = await admin
        .from("push_subscriptions")
        .select("endpoint,p256dh,auth")
        .eq("user_id", notification.recipient_id);
      if (subscriptionsError) return Response.json({ error: "Could not load push subscriptions." }, { status: 500 });

      const { data: claimed, error: claimError } = await admin
        .from("notifications")
        .update({ push_sent_at: new Date().toISOString() })
        .eq("id", notification.id)
        .is("push_sent_at", null)
        .select("id")
        .maybeSingle();
      if (claimError) return Response.json({ error: "Could not claim status notification delivery." }, { status: 500 });
      if (!claimed) continue;

      try {
        const sender = actor?.name || (actor?.username ? `@${actor.username}` : "Someone");
        const result = await sendPushNotifications(admin, subscriptions ?? [], {
          title: "New status",
          body: `${sender} shared a status.`,
          url: `/inbox?status=${status.id}`,
          tag: `status-${status.id}`,
        });
        sent += result.sent;
      } catch {
        await admin.from("notifications").update({ push_sent_at: null }).eq("id", notification.id);
        return Response.json({ error: "Push notification delivery failed." }, { status: 503 });
      }
    }
    return Response.json({ sent, total: (notifications ?? []).length });
  } else if (activity.type === "follow") {
    if (activity.profileId === user.id) return Response.json({ sent: 0, skipped: true });

    const { data: follow, error: followError } = await admin
      .from("follows")
      .select("followed_id")
      .eq("follower_id", user.id)
      .eq("followed_id", activity.profileId)
      .maybeSingle();
    if (followError) return Response.json({ error: "Could not verify follow activity." }, { status: 500 });
    if (!follow) return Response.json({ sent: 0, skipped: true });

    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id")
      .eq("recipient_id", activity.profileId)
      .eq("actor_id", user.id)
      .eq("type", "follow")
      .is("push_sent_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (notificationError) return Response.json({ error: "Could not find the follow notification." }, { status: 500 });
    notificationId = notification?.id ?? null;
    if (!notificationId) return Response.json({ sent: 0, skipped: true });
  } else if (activity.type === "profile_view") {
    if (activity.profileId === user.id) return Response.json({ sent: 0, skipped: true });

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id,visibility")
      .eq("id", activity.profileId)
      .maybeSingle();
    if (targetError) return Response.json({ error: "Could not verify profile access." }, { status: 500 });
    if (!target) return Response.json({ sent: 0, skipped: true });
    if (target.visibility === "followers") {
      const { data: follow, error: followError } = await admin
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("followed_id", target.id)
        .maybeSingle();
      if (followError) return Response.json({ error: "Could not verify profile access." }, { status: 500 });
      if (!follow) return Response.json({ sent: 0, skipped: true });
    } else if (target.visibility !== "public") {
      return Response.json({ sent: 0, skipped: true });
    }

    const { data, error } = await admin.rpc("record_profile_view_notification", {
      p_viewer_id: user.id,
      p_profile_id: activity.profileId,
    });
    if (error) return Response.json({ error: "Could not record profile notification." }, { status: 500 });
    notificationId = typeof data === "string" ? data : null;
    if (!notificationId) return Response.json({ sent: 0, skipped: true });
  } else if (activity.type === "message") {
    const { data: message, error: messageError } = await admin
      .from("messages")
      .select("id,conversation_id,sender_id")
      .eq("id", activity.messageId)
      .eq("sender_id", user.id)
      .maybeSingle();
    if (messageError) return Response.json({ error: "Could not verify the sent message." }, { status: 500 });
    if (!message) return Response.json({ sent: 0, skipped: true });
    messageConversationId = message.conversation_id;

    const { data: conversation, error: conversationError } = await admin
      .from("conversations")
      .select("participant_one,participant_two")
      .eq("id", message.conversation_id)
      .maybeSingle();
    if (conversationError) return Response.json({ error: "Could not verify the conversation." }, { status: 500 });
    if (!conversation || (conversation.participant_one !== user.id && conversation.participant_two !== user.id)) {
      return Response.json({ sent: 0, skipped: true });
    }

    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id")
      .eq("message_id", message.id)
      .eq("actor_id", user.id)
      .eq("type", "message")
      .is("push_sent_at", null)
      .maybeSingle();
    if (notificationError) return Response.json({ error: "Could not find the message notification." }, { status: 500 });
    notificationId = notification?.id ?? null;
    if (!notificationId) return Response.json({ sent: 0, skipped: true });
  } else {
    const { data: post, error: postError } = await admin
      .from("posts")
      .select("id,user_id,title")
      .eq("id", activity.postId)
      .maybeSingle();
    if (postError) return Response.json({ error: "Could not verify post activity." }, { status: 500 });
    if (!post || post.user_id === user.id) return Response.json({ sent: 0, skipped: true });

    const { data: event, error: eventError } = activity.type === "vibe"
      ? await admin.from("vibes").select("post_id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle()
      : await admin.from("comments").select("id").eq("post_id", post.id).eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (eventError) return Response.json({ error: "Could not verify post activity." }, { status: 500 });
    if (!event) return Response.json({ sent: 0, skipped: true });

    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id")
      .eq("recipient_id", post.user_id)
      .eq("actor_id", user.id)
      .eq("type", activity.type)
      .eq("post_id", post.id)
      .is("push_sent_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (notificationError) return Response.json({ error: "Could not find the in-app notification." }, { status: 500 });
    notificationId = notification?.id ?? null;
    if (!notificationId) return Response.json({ sent: 0, skipped: true });
  }

  const { data: notification, error: notificationError } = await admin
    .from("notifications")
    .select("id,recipient_id,actor_id,type,post_id,status_id")
    .eq("id", notificationId)
    .maybeSingle();
  if (notificationError) return Response.json({ error: "Could not load notification." }, { status: 500 });
  if (!notification) return Response.json({ sent: 0, skipped: true });

  const { data: actor, error: senderError } = notification.actor_id
    ? await admin.from("profiles").select("name,username").eq("id", notification.actor_id).maybeSingle()
    : { data: null, error: null };
  if (senderError) return Response.json({ error: "Could not load notification sender." }, { status: 500 });

  const { data: subscriptions, error: subscriptionsError } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", notification.recipient_id);
  if (subscriptionsError) return Response.json({ error: "Could not load push subscriptions." }, { status: 500 });

  const sender = actor?.name || (actor?.username ? `@${actor.username}` : "Someone");
  const messages: Record<string, { title: string; body: string }> = {
    follow: { title: "New follower", body: `${sender} started following you.` },
    vibe: { title: "New vibe", body: `${sender} reacted to your post.` },
    comment: { title: "New comment", body: `${sender} commented on your post.` },
    profile_view: { title: "Profile visit", body: `${sender} viewed your profile.` },
    message: { title: "New message", body: `${sender} sent you a message.` },
    status: { title: "New status", body: `${sender} shared a status.` },
  };
  const details = messages[notification.type];
  if (!details) return Response.json({ error: "Unsupported notification type." }, { status: 500 });
  const payload: PushPayload = {
    ...details,
    url: notification.post_id
      ? `/p/${notification.post_id}`
      : notification.type === "message"
        ? "/inbox"
        : notification.type === "status" && notification.status_id
          ? `/inbox?status=${notification.status_id}`
        : notification.type === "follow" && actor?.username
          ? `/${actor.username}`
          : "/notifications",
    tag: messageConversationId
      ? `conversation-${messageConversationId}`
      : `activity-${notification.id}`,
  };
  if (subscriptions?.length && (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY ||
    !process.env.VAPID_SUBJECT
  )) {
    return Response.json({ error: "Push delivery is not configured." }, { status: 503 });
  }

  const { data: claimed, error: claimError } = await admin
    .from("notifications")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("push_sent_at", null)
    .select("id,recipient_id,actor_id,type,post_id")
    .maybeSingle();
  if (claimError) return Response.json({ error: "Could not claim notification delivery." }, { status: 500 });
  if (!claimed) return Response.json({ sent: 0, skipped: true });

  try {
    const result = await sendPushNotifications(admin, subscriptions ?? [], payload);
    return Response.json(result);
  } catch {
    return Response.json({ error: "Push notification delivery failed." }, { status: 503 });
  }
}
