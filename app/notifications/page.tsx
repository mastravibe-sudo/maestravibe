"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CircleDot, Eye, Flame, Mail, MessageCircle, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/components/CurrentUserContext";
import { subscribeWithRecovery } from "@/lib/supabase/realtime";
import { requestActivityPush } from "@/lib/notifications/client";

type Notification = { id: string; type: "follow" | "vibe" | "comment" | "profile_view" | "message" | "status"; actor_id: string | null; post_id: string | null; status_id: string | null; message_id: string | null; created_at: string; read_at: string | null };
type Person = { id: string; username: string; name: string | null; avatar_url: string | null };
type PostMedia = { id: string; image_url: string | null; media: Array<{ type?: string; url?: string }> | null };
type Filter = "All" | "Mentions" | "Follows" | "Likes";

const timeLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const filters: Filter[] = ["All", "Mentions", "Follows", "Likes"];

export default function NotificationsPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const currentUser = useCurrentUser();
  const userId = currentUser.userId;
  const [items, setItems] = useState<Notification[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [mentionKeys, setMentionKeys] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeDisconnected, setRealtimeDisconnected] = useState(false);

  const load = useCallback(async () => {
    if (!currentUser.ready) return;
    setLoading(true);
    setError(null);
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    const notificationResult = await supabase
      .from("notifications")
      .select("id,type,actor_id,post_id,status_id,message_id,created_at,read_at")
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);
    const { data, error: queryError } = notificationResult;
    if (queryError) {
      setError(queryError.message);
      setItems([]);
    } else setItems((data ?? []) as Notification[]);
    const rows = (data ?? []) as Notification[];
    const actorIds = [...new Set(rows.flatMap((item) => item.actor_id ? [item.actor_id] : []))];
    if (actorIds.length) {
      const postIds = [...new Set(rows.flatMap((item) => item.post_id ? [item.post_id] : []))];
      const [actorsResult, postsResult, followingResult] = await Promise.all([
        supabase.from("profiles").select("id,username,name,avatar_url").in("id", actorIds),
        postIds.length ? supabase.from("posts").select("id,image_url,media").in("id", postIds) : Promise.resolve({ data: [], error: null }),
        supabase.from("follows").select("followed_id").eq("follower_id", userId),
      ]);
      const { data: actors, error: actorError } = actorsResult;
      if (actorError) setError(actorError.message);
      else setPeople(Object.fromEntries(((actors ?? []) as Person[]).map((person) => [person.id, person] as const)));
      if (postsResult.error) setError(postsResult.error.message);
      else setThumbnails(Object.fromEntries(((postsResult.data ?? []) as PostMedia[]).flatMap((post) => {
        const image = post.image_url || post.media?.find((media) => media.type === "image")?.url;
        return image ? [[post.id, image] as const] : [];
      })));
      if (followingResult.error) setError(followingResult.error.message);
      else setFollowingIds((followingResult.data ?? []).map((row) => row.followed_id as string));
      const username = currentUser.profile?.username;
      if (username && postIds.length) {
        const { data: comments, error: commentError } = await supabase.from("comments")
          .select("post_id,user_id,body")
          .in("post_id", postIds)
          .in("user_id", actorIds);
        if (commentError) setError(commentError.message);
        else setMentionKeys((comments ?? []).flatMap((comment) =>
          typeof comment.body === "string" && comment.body.toLowerCase().includes(`@${username.toLowerCase()}`)
            ? [`${comment.user_id}:${comment.post_id}`]
            : []
        ));
      } else setMentionKeys([]);
    } else {
      setPeople({});
      setThumbnails({});
      setFollowingIds([]);
      setMentionKeys([]);
    }
    setLoading(false);
  }, [currentUser.profile?.username, currentUser.ready, supabase, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    return subscribeWithRecovery({
      supabase,
      channelName: `notifications-page-${userId}`,
      configure: (channel) => channel
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        }, () => void load()),
      onDisconnected: () => setRealtimeDisconnected(true),
      onReconnected: () => setRealtimeDisconnected(false),
    });
  }, [load, supabase, userId]);

  const markAllRead = async () => {
    if (!userId) return;
    const { error: updateError } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", userId).is("read_at", null);
    if (updateError) setError(updateError.message);
    else await load();
  };

  const markRead = async (item: Notification) => {
    if (!userId || item.read_at) return;
    const { error: updateError } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", item.id).eq("recipient_id", userId);
    if (updateError) setError(updateError.message);
    else setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry));
  };

  const openNotification = async (event: React.MouseEvent<HTMLAnchorElement>, item: Notification, actor?: Person) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
      void markRead(item);
      return;
    }
    event.preventDefault();
    await markRead(item);
    router.push(targetFor(item, actor));
  };

  const unreadCount = items.filter((item) => !item.read_at).length;
  const needsMigration = !!error && error.includes("notifications");
  const notificationText = (item: Notification) => {
    if (item.type === "follow") return "started following you";
    if (item.type === "vibe") return "reacted to your post";
    if (item.type === "comment") return "commented on your post";
    if (item.type === "message") return "sent you a message";
    if (item.type === "status") return "shared a status";
    return "viewed your profile";
  };
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const visibleItems = items.filter((item) => {
    if (filter === "Follows") return item.type === "follow";
    if (filter === "Likes") return item.type === "vibe";
    if (filter === "Mentions") return item.type === "comment" && !!item.post_id && !!item.actor_id && mentionKeys.includes(`${item.actor_id}:${item.post_id}`);
    return true;
  });
  const todayItems = visibleItems.filter((item) => new Date(item.created_at) >= todayStart);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const yesterdayItems = visibleItems.filter((item) => new Date(item.created_at) >= yesterdayStart && new Date(item.created_at) < todayStart);
  const earlierItems = visibleItems.filter((item) => new Date(item.created_at) < yesterdayStart);
  const iconFor = (type: Notification["type"]) => {
    if (type === "follow") return <UserRound className="h-5 w-5" aria-hidden="true" />;
    if (type === "vibe") return <Flame className="h-5 w-5" aria-hidden="true" />;
    if (type === "comment") return <MessageCircle className="h-5 w-5" aria-hidden="true" />;
    if (type === "message") return <Mail className="h-5 w-5" aria-hidden="true" />;
    if (type === "status") return <CircleDot className="h-5 w-5" aria-hidden="true" />;
    return <Eye className="h-5 w-5" aria-hidden="true" />;
  };
  const targetFor = (item: Notification, actor?: Person) => item.type === "message"
    ? actor ? `/inbox?user=${encodeURIComponent(actor.id)}` : "/inbox"
    : item.type === "status" && item.status_id
      ? `/inbox?status=${item.status_id}`
      : item.post_id
        ? `/p/${item.post_id}`
        : item.type === "follow" && actor
          ? `/${actor.username}`
          : actor ? `/${actor.username}` : "/notifications";
  const renderGroup = (title: string, groupItems: Notification[]) => groupItems.length ? (
    <section key={title}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">{title}</h2>
      <div className="divide-y divide-white/10 border-y border-white/10">
        {groupItems.map((item) => {
          const actor = item.actor_id ? people[item.actor_id] : undefined;
          const thumbnail = item.post_id ? thumbnails[item.post_id] : null;
          return (
            <article key={item.id} className={`flex items-center gap-3 px-3 py-4 ${item.read_at ? "" : "bg-violet-500/4"}`}>
              <Link href={targetFor(item, actor)} onClick={(event) => void openNotification(event, item, actor)} aria-label={actor ? `Open ${actor.name || actor.username}'s notification` : "Open notification"} className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-violet-500/25 to-blue-500/20 text-violet-200">
                {actor?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={actor.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : <span aria-hidden="true">{iconFor(item.type)}</span>}
                <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#07061a] bg-linear-to-br from-violet-500 to-blue-500 text-white">{iconFor(item.type)}</span>
              </Link>
              <Link href={targetFor(item, actor)} onClick={(event) => void openNotification(event, item, actor)} className="min-w-0 flex-1">
                <p className="text-sm text-zinc-200"><span className="font-semibold text-white">{actor ? actor.name || `@${actor.username}` : "Someone"}</span> {notificationText(item)}.</p>
                <p className="mt-1 text-xs text-zinc-500">{timeLabel(item.created_at)}</p>
              </Link>
              {item.type === "follow" && actor && !followingIds.includes(actor.id) ? <button type="button" onClick={() => void followBack(actor)} className="shrink-0 rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] px-3 py-2 text-[11px] font-semibold text-white">Follow Back</button> : null}
              {thumbnail ? <Link href={targetFor(item, actor)} onClick={(event) => void openNotification(event, item, actor)} className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[#110f2e]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbnail} alt="" className="h-full w-full object-cover" />
              </Link> : null}
              {!item.read_at ? <button onClick={() => void markRead(item)} className="shrink-0 text-[11px] text-zinc-500 hover:text-white">Mark read</button> : null}
            </article>
          );
        })}
      </div>
    </section>
  ) : null;

  const followBack = async (person: Person) => {
    if (!userId || person.id === userId || followingIds.includes(person.id)) return;
    const { error: followError } = await supabase.from("follows").insert({ follower_id: userId, followed_id: person.id });
    if (followError) {
      setError(followError.message);
      return;
    }
    setFollowingIds((current) => [...current, person.id]);
    const pushError = await requestActivityPush({ type: "follow", profileId: person.id });
    if (pushError) setError(pushError);
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-[#07061a] px-4 py-8 pb-24 text-zinc-100 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Activity</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Notifications{unreadCount ? <span className="ml-2 align-middle text-base font-medium text-violet-300">{unreadCount} new</span> : null}</h1>
        </div>
        {unreadCount ? <button onClick={() => void markAllRead()} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Mark all read</button> : null}
      </header>

      {!userId && !loading ? <Link href="/login" className="block border border-white/10 bg-zinc-900 p-5 text-center text-sm text-zinc-300">Log in to view notifications</Link> : null}
      {error ? <p role="alert" className="mb-4 border border-amber-400/20 bg-amber-950/30 p-3 text-sm text-amber-100">{needsMigration ? "Run the notification and inbox SQL migrations to enable updates." : error}</p> : null}
      {realtimeDisconnected ? <p role="status" className="mb-4 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-200">Reconnecting to notifications…</p> : null}
      <div className="mb-5 flex gap-2 overflow-x-auto" role="tablist" aria-label="Notification filters">
        {filters.map((item) => <button key={item} type="button" role="tab" aria-selected={filter === item} onClick={() => setFilter(item)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium ${filter === item ? "bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-white" : "border border-white/10 bg-[#110f2e] text-[#c9c4e8]"}`}>{item}</button>)}
      </div>
      {loading ? <p className="py-12 text-center text-sm text-zinc-500">Loading notifications...</p> : userId ? (
        <div className="space-y-7">
          {visibleItems.length ? <div className="space-y-7">{renderGroup("Today", todayItems)}{renderGroup("Yesterday", yesterdayItems)}{renderGroup("Earlier", earlierItems)}</div> : null}

          {!visibleItems.length && !error ? <p className="py-16 text-center text-sm text-zinc-500">You’re all caught up. New follows, messages, post activity, and status updates will show here.</p> : null}
        </div>
      ) : null}
    </main>
  );
}
