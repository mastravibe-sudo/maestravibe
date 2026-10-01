"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import PushSubscriptionControl from "@/components/PushSubscriptionControl";

type Notification = { id: string; type: "follow" | "vibe" | "comment"; actor_id: string | null; post_id: string | null; created_at: string; read_at: string | null };
type Person = { id: string; username: string; name: string | null; avatar_url: string | null };
type Announcement = { id: string; title: string; body: string; published_at: string };

const timeLabel = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function NotificationsPage() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) {
      setItems([]);
      setAnnouncements([]);
      setLoading(false);
      return;
    }

    const [notificationResult, announcementResult] = await Promise.all([
      supabase
        .from("notifications")
        .select("id,type,actor_id,post_id,created_at,read_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(60),
      supabase
        .from("app_announcements")
        .select("id,title,body,published_at")
        .order("published_at", { ascending: false })
        .limit(20),
    ]);
    const { data, error: queryError } = notificationResult;
    if (queryError) {
      setError(queryError.message);
      setItems([]);
    } else setItems((data ?? []) as Notification[]);
    if (announcementResult.error) setError(announcementResult.error.message);
    setAnnouncements((announcementResult.data ?? []) as Announcement[]);

    const rows = (data ?? []) as Notification[];
    const actorIds = [...new Set(rows.flatMap((item) => item.actor_id ? [item.actor_id] : []))];
    if (actorIds.length) {
      const { data: actors, error: actorError } = await supabase.from("profiles").select("id,username,name,avatar_url").in("id", actorIds);
      if (actorError) setError(actorError.message);
      else setPeople(Object.fromEntries(((actors ?? []) as Person[]).map((person) => [person.id, person])));
    } else setPeople({});
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

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

  const unreadCount = items.filter((item) => !item.read_at).length;
  const needsMigration = !!error && (error.includes("notifications") || error.includes("app_announcements"));
  const notificationText = (item: Notification) => {
    if (item.type === "follow") return "started following you";
    if (item.type === "vibe") return "reacted to your post";
    return "commented on your post";
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 pb-24 text-zinc-100 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Activity</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Notifications{unreadCount ? <span className="ml-2 align-middle text-base font-medium text-violet-300">{unreadCount} new</span> : null}</h1>
        </div>
        {unreadCount ? <button onClick={() => void markAllRead()} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:bg-white/5">Mark all read</button> : null}
      </header>

      {!userId && !loading ? <Link href="/login" className="block border border-white/10 bg-zinc-900 p-5 text-center text-sm text-zinc-300">Log in to view notifications</Link> : null}
      {userId ? <PushSubscriptionControl enabled={true} /> : null}
      {error ? <p role="alert" className="mb-4 border border-amber-400/20 bg-amber-950/30 p-3 text-sm text-amber-100">{needsMigration ? "Run the social sections and admin console SQL migrations to enable updates." : error}</p> : null}
      {loading ? <p className="py-12 text-center text-sm text-zinc-500">Loading notifications...</p> : userId ? (
        <div className="space-y-7">
          {announcements.length ? (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">App updates</h2>
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <article key={announcement.id} className="rounded-xl border border-blue-400/15 bg-blue-500/5 p-4">
                    <p className="font-semibold text-white">{announcement.title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{announcement.body}</p>
                    <p className="mt-3 text-xs text-zinc-500">{timeLabel(announcement.published_at)}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {items.length ? (
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Your activity</h2>
              <div className="divide-y divide-white/10 border-y border-white/10">
                {items.map((item) => {
                  const actor = item.actor_id ? people[item.actor_id] : undefined;
                  return (
                    <article key={item.id} className={`flex items-start gap-3 py-4 ${item.read_at ? "" : "bg-violet-500/4"}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-lg">{item.type === "follow" ? "👤" : item.type === "vibe" ? "🔥" : "💬"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-200"><span className="font-semibold text-white">{actor ? actor.name || `@${actor.username}` : "Someone"}</span> {notificationText(item)}.</p>
                        <p className="mt-1 text-xs text-zinc-500">{timeLabel(item.created_at)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        {actor ? <Link href={`/${actor.username}`} className="text-xs text-violet-300 hover:text-violet-200">View profile</Link> : null}
                        {!item.read_at ? <button onClick={() => void markRead(item)} className="text-[11px] text-zinc-500 hover:text-white">Mark read</button> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {!announcements.length && !items.length && !error ? <p className="py-16 text-center text-sm text-zinc-500">You’re all caught up. New follows, post activity, and app updates will show here.</p> : null}
        </div>
      ) : null}
    </main>
  );
}
