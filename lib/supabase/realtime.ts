import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type ChannelStatus = "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | string;

type RealtimeRecoveryOptions = {
  supabase: SupabaseClient;
  channelName: string;
  configure: (channel: RealtimeChannel) => RealtimeChannel;
  onDisconnected?: () => void;
  onReconnected?: () => void;
};

const DISCONNECTED_AFTER_MS = 10_000;
const MAX_RETRY_MS = 30_000;

export function subscribeWithRecovery({
  supabase,
  channelName,
  configure,
  onDisconnected,
  onReconnected,
}: RealtimeRecoveryOptions) {
  let stopped = false;
  let channel: RealtimeChannel | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let disconnectedAt: number | null = null;
  let attempts = 0;
  let replacement: Promise<void> | null = null;

  const clearRetry = () => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
  };
  const clearDisconnectTimer = () => {
    if (disconnectTimer) clearTimeout(disconnectTimer);
    disconnectTimer = null;
  };

  const scheduleReconnect = () => {
    if (stopped || retryTimer) return;
    if (disconnectedAt === null) {
      disconnectedAt = Date.now();
      disconnectTimer = setTimeout(() => {
        if (!stopped && disconnectedAt !== null) onDisconnected?.();
      }, DISCONNECTED_AFTER_MS);
    }

    const delay = Math.min(1_000 * (2 ** attempts), MAX_RETRY_MS);
    attempts += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void replaceChannel();
    }, delay);
  };

  const handleStatus = (current: RealtimeChannel, status: ChannelStatus, error?: Error) => {
    if (stopped || channel !== current) return;
    if (status === "SUBSCRIBED") {
      attempts = 0;
      disconnectedAt = null;
      clearRetry();
      clearDisconnectTimer();
      onReconnected?.();
      return;
    }
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
      if (error) console.error(`Realtime channel ${channelName} failed.`, error.message);
      scheduleReconnect();
    }
  };

  const createChannel = () => {
    if (stopped) return;
    const current = configure(supabase.channel(channelName));
    channel = current;
    current.subscribe((status, error) => handleStatus(current, status, error));
  };

  const replaceChannel = () => {
    if (stopped) return Promise.resolve();
    if (replacement) return replacement;
    replacement = (async () => {
      clearRetry();
      const oldChannel = channel;
      channel = null;
      if (oldChannel) await supabase.removeChannel(oldChannel);
      if (!stopped) createChannel();
    })().finally(() => {
      replacement = null;
    });
    return replacement;
  };

  createChannel();
  const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "TOKEN_REFRESHED" && event !== "SIGNED_IN" && event !== "SIGNED_OUT") return;
    window.setTimeout(() => {
      if (stopped) return;
      void supabase.realtime.setAuth(session?.access_token ?? null).then(() => replaceChannel());
    }, 0);
  });

  return () => {
    stopped = true;
    clearRetry();
    clearDisconnectTimer();
    authListener.subscription.unsubscribe();
    const oldChannel = channel;
    channel = null;
    if (oldChannel) void supabase.removeChannel(oldChannel);
  };
}
