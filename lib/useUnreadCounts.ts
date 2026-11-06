"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { subscribeWithRecovery } from "@/lib/supabase/realtime";

export type UnreadNotificationCounts = {
  vibe: number;
  comment: number;
  follow: number;
  message: number;
  total: number;
};

const EMPTY_COUNTS: UnreadNotificationCounts = { vibe: 0, comment: 0, follow: 0, message: 0, total: 0 };

function syncBadge(count: number) {
  if (typeof navigator === "undefined") return;
  if (count > 0 && typeof navigator.setAppBadge === "function") {
    void navigator.setAppBadge(count).catch((error: unknown) => console.error("Could not update app badge.", error));
  } else if (count === 0 && typeof navigator.clearAppBadge === "function") {
    void navigator.clearAppBadge().catch((error: unknown) => console.error("Could not clear app badge.", error));
  }
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.ready.then((registration) => {
      registration.active?.postMessage({ type: "BADGE_COUNT", count });
    }).catch((error: unknown) => console.error("Could not sync service-worker badge.", error));
  }
}

export function useUnreadCounts(userId: string | null, enabled = true) {
  const pathname = usePathname();
  const [notificationCounts, setNotificationCounts] = useState(EMPTY_COUNTS);
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (typeof navigator !== "undefined" && "clearAppBadge" in navigator) {
      void navigator.clearAppBadge().catch((error: unknown) => console.error("Could not clear app badge on open.", error));
    }
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then((registration) => registration.active?.postMessage({ type: "APP_OPENED" }))
        .catch((error: unknown) => console.error("Could not reset service-worker badge on open.", error));
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!enabled || !userId) {
      queueMicrotask(() => {
        if (!active) return;
        setNotificationCounts(EMPTY_COUNTS);
        setUnreadMessages(0);
      });
      syncBadge(0);
      return () => {
        active = false;
      };
    }

    const supabase = createClient();
    const loadCounts = async () => {
      const unreadQuery = (type?: string) => {
        let query = supabase.from("notifications").select("id", { count: "exact", head: true })
          .eq("recipient_id", userId).is("read_at", null);
        if (type) query = query.eq("type", type);
        return query;
      };
      const [all, vibes, comments, follows, messages, summaries] = await Promise.all([
        unreadQuery(),
        unreadQuery("vibe"),
        unreadQuery("comment"),
        unreadQuery("follow"),
        unreadQuery("message"),
        supabase.rpc("get_inbox_conversation_summaries"),
      ]);
      const countError = all.error ?? vibes.error ?? comments.error ?? follows.error ?? messages.error;
      if (countError) {
        console.error("Could not load unread notification counts.", countError.message);
        return;
      }
      if (summaries.error) {
        console.error("Could not load unread inbox counts.", summaries.error.message);
        return;
      }
      if (!active) return;
      const nextNotifications = {
        vibe: vibes.count ?? 0,
        comment: comments.count ?? 0,
        follow: follows.count ?? 0,
        message: messages.count ?? 0,
        total: all.count ?? 0,
      };
      const messageCount = ((summaries.data ?? []) as Array<{ unread_count: number | string | null }>)
        .reduce((total, row) => total + Number(row.unread_count ?? 0), 0);
      setNotificationCounts(nextNotifications);
      setUnreadMessages(messageCount);
      syncBadge(nextNotifications.total + messageCount);
      const title = document.title.replace(/^\(\d+\+?\)\s*/, "");
      document.title = nextNotifications.total + messageCount > 0
        ? `(${Math.min(nextNotifications.total + messageCount, 99)}${nextNotifications.total + messageCount > 99 ? "+" : ""}) ${title}`
        : title;
    };

    void loadCounts();
    const unsubscribe = subscribeWithRecovery({
      supabase,
      channelName: `unread-counts-${userId}`,
      configure: (channel) => channel
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` }, () => void loadCounts())
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => void loadCounts())
        .on("postgres_changes", { event: "*", schema: "public", table: "message_reads", filter: `reader_id=eq.${userId}` }, () => void loadCounts()),
      onDisconnected: () => console.error("Unread count updates remain disconnected after automatic retries."),
    });
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void loadCounts();
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
      unsubscribe();
    };
  }, [enabled, pathname, userId]);

  return { notificationCounts, unreadMessages };
}
