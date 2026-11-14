"use client";

import { useEffect, useRef, useState } from "react";
import type { createClient } from "@/lib/supabase/client";

type Supabase = ReturnType<typeof createClient>;
type TypingChannel = ReturnType<Supabase["channel"]>;

const SEND_EVERY_MS = 2500;
const IDLE_STOP_MS = 4000;
const SHOW_FOR_MS = 4500;

// Typing indicator over a Supabase Realtime broadcast channel. No database changes.
// Only a user id and a true/false flag are sent, never message text.
export function useTypingIndicator({
  supabase,
  conversationId,
  userId,
  draft,
}: {
  supabase: Supabase;
  conversationId: string | null | undefined;
  userId: string | null | undefined;
  draft: string;
}) {
  const [typingIn, setTypingIn] = useState<string | null>(null);
  const channelRef = useRef<TypingChannel | null>(null);
  const lastSentRef = useRef(0);
  const typingSentRef = useRef(false);

  // Listen for the other person typing in this conversation.
  useEffect(() => {
    if (!conversationId || !userId) return;
    const live: { channel: TypingChannel | null; hideTimer: number | undefined } = { channel: null, hideTimer: undefined };
    const startTimer = window.setTimeout(() => {
      const channel = supabase.channel("typing:" + conversationId, { config: { broadcast: { self: false } } });
      channel.on("broadcast", { event: "typing" }, (message) => {
        const payload = message.payload as { userId?: string; typing?: boolean } | undefined;
        if (!payload || payload.userId === userId) return;
        window.clearTimeout(live.hideTimer);
        if (payload.typing === false) {
          setTypingIn(null);
          return;
        }
        setTypingIn(conversationId);
        live.hideTimer = window.setTimeout(() => setTypingIn(null), SHOW_FOR_MS);
      });
      channel.subscribe();
      live.channel = channel;
      channelRef.current = channel;
    }, 0);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(live.hideTimer);
      channelRef.current = null;
      typingSentRef.current = false;
      if (live.channel) void supabase.removeChannel(live.channel);
    };
  }, [supabase, conversationId, userId]);

  // Tell the other person when I am typing, and when I stop.
  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !userId) return;
    const send = (typing: boolean) => {
      void channel.send({ type: "broadcast", event: "typing", payload: { userId, typing } });
    };
    if (draft.trim().length === 0) {
      if (typingSentRef.current) {
        typingSentRef.current = false;
        send(false);
      }
      return;
    }
    const now = Date.now();
    if (now - lastSentRef.current > SEND_EVERY_MS) {
      lastSentRef.current = now;
      typingSentRef.current = true;
      send(true);
    }
    const idle = window.setTimeout(() => {
      typingSentRef.current = false;
      send(false);
    }, IDLE_STOP_MS);
    return () => window.clearTimeout(idle);
  }, [draft, conversationId, userId]);

  return { peerTyping: typingIn !== null && typingIn === conversationId };
}
