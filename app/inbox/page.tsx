"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, CheckCheck, Download, ImagePlus, MessageCircle, Mic, Send, Smile, SquarePen, Sticker, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import StatusBar from "@/components/StatusBar";
import { subscribeWithRecovery } from "@/lib/supabase/realtime";
import { compressImage } from "@/lib/media/compress";
import { useCurrentUser } from "@/components/CurrentUserContext";
import { requestActivityPush } from "@/lib/notifications/client";
import {
  createZip,
  getCachedMedia,
  getCachedMessages,
  saveCachedMedia,
  saveCachedMessages,
  type CachedMessage,
} from "@/lib/inbox/local-store";

type Person = { id: string; username: string; name: string | null; avatar_url: string | null };
type InboxSummary = {
  conversation_id: string;
  participant_one: string;
  participant_two: string;
  last_message_at: string;
  last_body: string | null;
  last_image_url: string | null;
  last_sender_id: string | null;
  unread_count: number;
};
type Message = CachedMessage;

const fieldClass = "w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400";
const avatarLabel = (person: Person) => (person.name || person.username).slice(0, 1).toUpperCase();
const formatMessageTime = (date: string) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(date));
const QUICK_EMOJIS = ["💜", "✨", "😊", "😂", "🥰", "🔥", "🪐", "🌙", "💫", "🫶"];
const QUICK_STICKERS = ["💜✨", "🚀🌙", "🪐💫", "🫶🏽"];

async function uploadChatImage(image: Blob) {
  const form = new FormData();
  form.append("purpose", "chat-image");
  form.append("file", image, "message.webp");
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const result = await response.json() as { publicUrl?: string; error?: string };
  if (!response.ok || !result.publicUrl) throw new Error(result.error ?? "Image upload failed.");
  return result.publicUrl;
}

async function uploadChatVoice(voice: Blob) {
  const form = new FormData();
  form.append("purpose", "chat-voice");
  form.append("file", voice, "voice-message.webm");
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const result = await response.json() as { publicUrl?: string; error?: string };
  if (!response.ok || !result.publicUrl) throw new Error(result.error ?? "Voice message upload failed.");
  return result.publicUrl;
}

export default function InboxPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const currentUser = useCurrentUser();
  const userId = currentUser.userId;
  const [summaries, setSummaries] = useState<InboxSummary[]>([]);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [friends, setFriends] = useState<Person[]>([]);
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(() => new Set());
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [inboxTab, setInboxTab] = useState<"Messages" | "Status">("Messages");
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<Blob | null>(null);
  const [voicePreview, setVoicePreview] = useState<string | null>(null);
  const [localMediaUrls, setLocalMediaUrls] = useState<Record<string, string>>({});
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [picker, setPicker] = useState<"emoji" | "sticker" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [followingBusyId, setFollowingBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [realtimeDisconnected, setRealtimeDisconnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const handledMessageRequest = useRef<string | null>(null);
  const localMediaUrlsRef = useRef<Record<string, string>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const waveformFrameRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const recordingLimitRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const recordingHeldRef = useRef(false);
  const recordingStartingRef = useRef(false);
  const selectedSummary = summaries.find((summary) => summary.conversation_id === selectedConversationId) ?? null;
  const otherId = selectedSummary
    ? selectedSummary.participant_one === userId ? selectedSummary.participant_two : selectedSummary.participant_one
    : null;
  const otherPerson = otherId ? people[otherId] : null;
  const inboxLoading = !currentUser.ready || (!!userId && loading);

  const loadCommunity = useCallback(async () => {
    if (!currentUser.ready) return;
    if (!userId) {
      setFriends([]);
      setSuggestions([]);
      setCommunityLoading(false);
      return;
    }

    setCommunityLoading(true);
    const [followingResult, followersResult] = await Promise.all([
      supabase.from("follows").select("followed_id").eq("follower_id", userId),
      supabase.from("follows").select("follower_id").eq("followed_id", userId),
    ]);

    const relationshipError = followingResult.error ?? followersResult.error;
    if (relationshipError) {
      setError(relationshipError.message);
      setCommunityLoading(false);
      return;
    }

    const followedIds = new Set((followingResult.data ?? []).map((row) => row.followed_id as string));
    const followerIds = new Set((followersResult.data ?? []).map((row) => row.follower_id as string));
    const mutualIds = [...followedIds].filter((id) => followerIds.has(id));
    const [friendsResult, profilesResult] = await Promise.all([
      mutualIds.length
        ? supabase.from("profiles").select("id,username,name,avatar_url").in("id", mutualIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("profiles").select("id,username,name,avatar_url").neq("id", userId).order("created_at", { ascending: false }).limit(40),
    ]);
    const profileError = friendsResult.error ?? profilesResult.error;
    if (profileError) {
      setError(profileError.message);
      setCommunityLoading(false);
      return;
    }

    const mutualFriends = (friendsResult.data ?? []) as Person[];
    const profiles = (profilesResult.data ?? []) as Person[];
    setFriends(mutualFriends);
    setSuggestions(profiles.filter((person) => !followedIds.has(person.id)).slice(0, 6));
    setPeople((current) => ({
      ...current,
      ...Object.fromEntries([...mutualFriends, ...profiles].map((person) => [person.id, person])),
    }));
    setCommunityLoading(false);
  }, [currentUser.ready, supabase, userId]);

  const loadSummaries = useCallback(async () => {
    if (!userId) return;
    const { data, error: summaryError } = await supabase.rpc("get_inbox_conversation_summaries");
    if (summaryError) {
      setError(summaryError.message);
      setSummaries([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as InboxSummary[];
    setSummaries(rows);
    const ids = [...new Set(rows.flatMap((row) => [row.participant_one, row.participant_two]))].filter((id) => id !== userId);
    if (ids.length) {
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id,username,name,avatar_url").in("id", ids);
      if (profilesError) setError(profilesError.message);
      else {
        setPeople((current) => ({
          ...current,
          ...Object.fromEntries(((profiles ?? []) as Person[]).map((person) => [person.id, person])),
        }));
      }
    }
    setLoading(false);
  }, [supabase, userId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    let cachedRows: Message[] = [];
    let messageCacheReady = true;
    try {
      cachedRows = await getCachedMessages(conversationId);
      setMessages(cachedRows);
    } catch (cacheError) {
      messageCacheReady = false;
      setError(cacheError instanceof Error ? cacheError.message : "Could not read local chat history.");
    }

    const { data, error: messagesError } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,image_url,voice_url,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (messagesError) {
      setError(cachedRows.length
        ? "You are offline. Showing chat history saved on this device."
        : messagesError.message);
      return;
    }

    let rows = (data ?? []) as Message[];
    const merged = new Map(cachedRows.map((message) => [message.id, message]));
    rows.forEach((message) => merged.set(message.id, message));
    rows = [...merged.values()].sort((left, right) => left.created_at.localeCompare(right.created_at));
    setMessages(rows);
    try {
      await saveCachedMessages(rows);
    } catch (cacheError) {
      messageCacheReady = false;
      setError(cacheError instanceof Error ? cacheError.message : "Could not save chat history on this device.");
    }

    for (const message of rows) {
      const mediaUrl = message.voice_url ?? message.image_url;
      if (!mediaUrl) continue;

      let cachedMedia = null;
      try {
        cachedMedia = await getCachedMedia(message.id);
      } catch (cacheError) {
        setError(cacheError instanceof Error ? cacheError.message : "Could not read local chat media.");
      }

      if (!cachedMedia) {
        try {
          const remoteIsChatMedia = mediaUrl.includes("/chat-media/");
          const response = await fetch(remoteIsChatMedia ? `/api/chat/media/${message.id}` : mediaUrl);
          if (!response.ok) throw new Error("A shared media file could not be downloaded.");
          const blob = await response.blob();
          await saveCachedMedia(message.id, blob);
          cachedMedia = { messageId: message.id, blob, mimeType: blob.type };
        } catch (mediaError) {
          setError(mediaError instanceof Error ? mediaError.message : "A shared media file could not be saved on this device.");
        }
      }

      if (cachedMedia) {
        if (!localMediaUrlsRef.current[message.id]) {
          const localUrl = URL.createObjectURL(cachedMedia.blob);
          localMediaUrlsRef.current = { ...localMediaUrlsRef.current, [message.id]: localUrl };
          setLocalMediaUrls(localMediaUrlsRef.current);
        }
        if (messageCacheReady && message.sender_id !== userId && mediaUrl.includes("/chat-media/")) {
          try {
            const response = await fetch("/api/chat/media/delivered", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messageId: message.id }),
            });
            if (!response.ok) {
              const result = await response.json() as { error?: string };
              throw new Error(result.error ?? "Could not delete the delivered media copy.");
            }
            const deliveredMessage = {
              ...message,
              body: message.body || (message.voice_url ? "Voice message" : "Photo"),
              image_url: null,
              voice_url: null,
            };
            rows = rows.map((row) => row.id === message.id ? deliveredMessage : row);
            await saveCachedMessages([deliveredMessage]);
            setMessages(rows);
          } catch (deliveryError) {
            setError(deliveryError instanceof Error ? deliveryError.message : "Could not remove the delivered server copy.");
          }
        }
      }
    }

    const ids = (data ?? []).map((message) => (message as Message).id);
    if (!ids.length) {
      setReadMessageIds(new Set());
      return;
    }

    const { data: receipts, error: receiptsError } = await supabase
      .from("message_reads")
      .select("message_id,reader_id")
      .eq("conversation_id", conversationId)
      .in("message_id", ids);
    if (receiptsError) {
      setError(receiptsError.message);
      return;
    }

    const readIds = new Set((receipts ?? [])
      .filter((receipt) => receipt.reader_id !== userId)
      .map((receipt) => receipt.message_id as string));
    setReadMessageIds(readIds);
    const existingReadIds = new Set((receipts ?? []).map((receipt) => receipt.message_id as string));
    const unreadIncoming = rows.filter((message) => message.sender_id !== userId && !existingReadIds.has(message.id));
    if (unreadIncoming.length) {
      const { error: readError } = await supabase.from("message_reads").upsert(
        unreadIncoming.map((message) => ({
          conversation_id: conversationId,
          message_id: message.id,
          reader_id: userId,
        })),
        { onConflict: "message_id,reader_id", ignoreDuplicates: true }
      );
      if (readError) setError(readError.message);
      else {
        void loadSummaries();
      }
    }
  }, [loadSummaries, supabase, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCommunity();
  }, [loadCommunity]);

  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSummaries();
    const unsubscribe = subscribeWithRecovery({
      supabase,
      channelName: `inbox-${userId}`,
      configure: (channel) => channel
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as Partial<Message>;
        if (row.conversation_id === selectedConversationId && selectedConversationId) void loadMessages(selectedConversationId);
        void loadSummaries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, (payload) => {
        const row = (payload.new ?? payload.old) as { conversation_id?: string };
        if (row.conversation_id === selectedConversationId && selectedConversationId) void loadMessages(selectedConversationId);
        void loadSummaries();
      }),
      onDisconnected: () => setRealtimeDisconnected(true),
      onReconnected: () => setRealtimeDisconnected(false),
    });
    return unsubscribe;
  }, [loadMessages, loadSummaries, selectedConversationId, supabase, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (imagePreview) return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => {
    if (voicePreview) return () => URL.revokeObjectURL(voicePreview);
  }, [voicePreview]);

  useEffect(() => () => {
    Object.values(localMediaUrlsRef.current).forEach(URL.revokeObjectURL);
    if (waveformFrameRef.current !== null) cancelAnimationFrame(waveformFrameRef.current);
    if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
    if (recordingLimitRef.current !== null) window.clearTimeout(recordingLimitRef.current);
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (audioContextRef.current && audioContextRef.current.state !== "closed") void audioContextRef.current.close();
  }, []);

  useEffect(() => {
    const username = search.trim().replace(/^@/, "").replace(/[^a-zA-Z0-9_.-]/g, "");
    if (username.length < 2 || !userId) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const { data, error: searchError } = await supabase
        .from("profiles")
        .select("id,username,name,avatar_url")
        .ilike("username", `%${username}%`)
        .neq("id", userId)
        .limit(8);
      if (!active) return;
      if (searchError) setError(searchError.message);
      setSearchResults((data ?? []) as Person[]);
      setSearching(false);
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, supabase, userId]);

  const openConversation = useCallback((conversationId: string, senderId?: string) => {
    setMessages([]);
    setReadMessageIds(new Set());
    setSelectedConversationId(conversationId);
    void loadMessages(conversationId);
    if (userId && senderId) {
      void supabase.from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", userId)
        .eq("actor_id", senderId)
        .eq("type", "message")
        .is("read_at", null)
        .then(({ error: notificationError }) => {
          if (notificationError) setError(notificationError.message);
        });
    }
  }, [loadMessages, supabase, userId]);

  const startConversation = useCallback(async (person: Person) => {
    if (!userId || person.id === userId) return;
    setError(null);
    const [participantOne, participantTwo] = [userId, person.id].sort();
    const existing = summaries.find((summary) =>
      summary.participant_one === participantOne && summary.participant_two === participantTwo
    );
    if (existing) {
      openConversation(existing.conversation_id, person.id);
      setSearch("");
      setSearchResults([]);
      return;
    }
    const { data, error: createError } = await supabase
      .from("conversations")
      .insert({ participant_one: participantOne, participant_two: participantTwo })
      .select("id")
      .single();
    if (createError) {
      if (createError.code === "23505") {
        const { data: raced, error: raceError } = await supabase
          .from("conversations")
          .select("id")
          .eq("participant_one", participantOne)
          .eq("participant_two", participantTwo)
          .maybeSingle();
        if (raceError) setError(raceError.message);
        else if (raced) {
          await loadSummaries();
          openConversation(raced.id, person.id);
        } else setError("That conversation could not be opened. Refresh and try again.");
      } else setError(createError.message);
      return;
    }
    setPeople((current) => ({ ...current, [person.id]: person }));
    setSearch("");
    setSearchResults([]);
    await loadSummaries();
    openConversation(data.id, person.id);
  }, [loadSummaries, openConversation, summaries, supabase, userId]);

  useEffect(() => {
    if (!currentUser.ready || !userId || loading) return;
    const requestedUserId = new URLSearchParams(window.location.search).get("user");
    if (!requestedUserId || requestedUserId === userId || handledMessageRequest.current === requestedUserId) return;
    handledMessageRequest.current = requestedUserId;

    const openRequestedConversation = async () => {
      const { data: person, error: profileError } = await supabase
        .from("profiles")
        .select("id,username,name,avatar_url")
        .eq("id", requestedUserId)
        .maybeSingle();
      if (profileError) setError(profileError.message);
      else if (person) {
        await startConversation(person as Person);
      } else {
        setError("This profile is no longer available.");
      }
      router.replace("/inbox", { scroll: false });
    };
    void openRequestedConversation();
  }, [currentUser.ready, loading, router, startConversation, supabase, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (new URLSearchParams(window.location.search).has("status")) setInboxTab("Status");
  }, []);

  const followPerson = async (person: Person) => {
    if (!userId || followingBusyId) return;
    setFollowingBusyId(person.id);
    setError(null);
    const { error: followError } = await supabase.from("follows").insert({
      follower_id: userId,
      followed_id: person.id,
    });
    if (followError) {
      setError(followError.message);
    } else {
      const pushError = await requestActivityPush({ type: "follow", profileId: person.id });
      if (pushError) setError(pushError);
      await loadCommunity();
    }
    setFollowingBusyId(null);
  };

  const updateSearch = (value: string) => {
    setSearch(value);
    if (value.trim().replace(/^@/, "").replace(/[^a-zA-Z0-9_.-]/g, "").length < 2) setSearchResults([]);
  };

  const chooseImage = (file?: File) => {
    if (!file) return;
    if (voiceFile || recording) {
      setError("Send or remove the voice message before attaching a photo.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const startRecording = async () => {
    if (recording || recordingStartingRef.current || recorderRef.current?.state === "recording") return;
    if (imageFile) {
      setError("Send or remove the photo before recording a voice message.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported by this browser.");
      return;
    }
    const mimeType = "audio/webm;codecs=opus";
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      setError("This browser cannot record Opus audio in WebM.");
      return;
    }

    setError(null);
    recordingStartingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStartingRef.current = false;
      if (!recordingHeldRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      recordingStreamRef.current = stream;
      const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 24_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      const drawWaveform = () => {
        analyser.getByteTimeDomainData(samples);
        const bars = Array.from({ length: 16 }, (_, index) => {
          const sample = samples[index * 2] ?? 128;
          return Math.max(12, Math.min(100, Math.abs(sample - 128) * 2.4));
        });
        setWaveform(bars);
        waveformFrameRef.current = requestAnimationFrame(drawWaveform);
      };
      void audioContext.resume();
      drawWaveform();
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => setError("Voice recording failed. Please try again.");
      recorder.onstop = () => {
        const voice = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (voice.size) {
          setVoiceFile(voice);
          setVoicePreview(URL.createObjectURL(voice));
        }
        else setError("No audio was recorded. Hold the microphone button while speaking.");
        chunksRef.current = [];
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        if (audioContext.state !== "closed") void audioContext.close();
        audioContextRef.current = null;
        if (waveformFrameRef.current !== null) cancelAnimationFrame(waveformFrameRef.current);
        waveformFrameRef.current = null;
        if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
        if (recordingLimitRef.current !== null) window.clearTimeout(recordingLimitRef.current);
        recordingTimerRef.current = null;
        recordingLimitRef.current = null;
        recordingHeldRef.current = false;
        setRecording(false);
        setWaveform([]);
      };
      recorder.start(250);
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - recordingStartedAtRef.current) / 1000));
      }, 250);
      recordingLimitRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 120_000);
    } catch (recordingError) {
      recordingStartingRef.current = false;
      recordingHeldRef.current = false;
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setError(recordingError instanceof Error ? recordingError.message : "Could not access the microphone.");
    }
  };

  const stopRecording = () => {
    recordingHeldRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const exportConversation = async () => {
    if (!selectedConversationId || !userId || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const history = await getCachedMessages(selectedConversationId);
      if (!history.length) throw new Error("There is no chat history saved on this device yet.");
      const attachments: Array<{ name: string; data: Uint8Array }> = [];
      const transcript: string[] = [
        `Maestra Vibe chat with ${otherPerson?.name || otherPerson?.username || "member"}`,
        `Conversation ID: ${selectedConversationId}`,
        "",
      ];
      for (const message of history) {
        const sender = message.sender_id === userId ? "You" : otherPerson?.name || otherPerson?.username || "Other person";
        transcript.push(`[${new Date(message.created_at).toLocaleString()}] ${sender}: ${message.body || (message.voice_url ? "Voice message" : message.image_url ? "Photo" : "")}`);
        const media = await getCachedMedia(message.id);
        if (media) {
          const extension = media.mimeType.includes("audio") ? "webm" : "webp";
          attachments.push({
            name: `media/${new Date(message.created_at).getTime()}-${message.id}.${extension}`,
            data: new Uint8Array(await media.blob.arrayBuffer()),
          });
        }
      }
      const zip = createZip([
        { name: "chat-history.txt", data: new TextEncoder().encode(transcript.join("\n")) },
        ...attachments,
      ]);
      const downloadUrl = URL.createObjectURL(zip);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `maestra-chat-${selectedConversationId}.zip`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not export chat history.");
    } finally {
      setExporting(false);
    }
  };

  const sendMessage = async () => {
    if (!userId || !selectedConversationId || (!draft.trim() && !imageFile && !voiceFile) || sending || recording) return;
    if (imageFile && voiceFile) {
      setError("Send a photo and a voice message separately.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const compressedImage = imageFile ? await compressImage(imageFile, 150 * 1024) : null;
      const [imageUrl, voiceUrl] = await Promise.all([
        compressedImage ? uploadChatImage(compressedImage) : Promise.resolve(null),
        voiceFile ? uploadChatVoice(voiceFile) : Promise.resolve(null),
      ]);
      const body = draft.trim() || (voiceFile ? "Voice message" : imageFile ? "Photo" : "");
      const { data: sentMessage, error: sendError } = await supabase.from("messages").insert({
        conversation_id: selectedConversationId,
        sender_id: userId,
        body,
        image_url: imageUrl,
        voice_url: voiceUrl,
      }).select("id,conversation_id,sender_id,body,image_url,voice_url,created_at").single();
      if (sendError) throw new Error(sendError.message);
      const savedMessage = sentMessage as Message;
      await saveCachedMessages([savedMessage]);
      if (compressedImage) await saveCachedMedia(savedMessage.id, compressedImage);
      if (voiceFile) await saveCachedMedia(savedMessage.id, voiceFile);
      setDraft("");
      setImageFile(null);
      setImagePreview(null);
      setVoiceFile(null);
      setVoicePreview(null);
      setPicker(null);
      let pushWarning: string | null = null;
      try {
        const pushResponse = await fetch("/api/notifications/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "message", messageId: sentMessage.id }),
        });
        if (!pushResponse.ok) pushWarning = "Message sent, but its push notification could not be delivered.";
      } catch {
        pushWarning = "Message sent, but its push notification could not be delivered.";
      }
      await Promise.all([loadMessages(selectedConversationId), loadSummaries()]);
      if (pushWarning) setError(pushWarning);
    } catch (sendFailure) {
      setError(sendFailure instanceof Error ? sendFailure.message : "Could not send this message.");
    } finally {
      setSending(false);
    }
  };

  const unreadTotal = summaries.reduce((total, summary) => total + Number(summary.unread_count), 0);

  return (
    <main className="mx-auto flex h-[calc(100dvh-5rem)] max-w-7xl overflow-hidden border-x border-white/10 bg-[#07061a] text-zinc-100 md:h-dvh">
      <aside className={`flex w-full shrink-0 flex-col border-r border-white/10 bg-[#0e0b20] sm:w-[340px] lg:w-[390px] ${selectedConversationId ? "hidden sm:flex" : "flex"}`}>
        <header className="border-b border-white/10 px-4 pb-4 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">Messages</p>
              <h1 className="mt-1 text-2xl font-bold text-white">Inbox{unreadTotal ? <span className="ml-2 text-sm font-semibold text-violet-300">{unreadTotal}</span> : null}</h1>
            </div>
            <button type="button" onClick={() => { setInboxTab("Messages"); searchInputRef.current?.focus(); }} aria-label="Compose message" className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-white"><SquarePen className="h-5 w-5" /></button>
          </div>
          <div className="mb-4 flex rounded-full bg-[#110f2e] p-1" role="tablist" aria-label="Inbox sections">
            {(["Messages", "Status"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={inboxTab === item} onClick={() => setInboxTab(item)} className={`h-10 flex-1 rounded-full text-sm font-semibold ${inboxTab === item ? "bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-white" : "text-[#a8a2c9]"}`}>{item}</button>)}
          </div>
          {realtimeDisconnected ? <p role="status" className="mb-3 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-200">Reconnecting to inbox updates…</p> : null}
          {inboxTab === "Messages" ? <input ref={searchInputRef} value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Find someone by username" aria-label="Find someone by username" className={fieldClass} /> : null}
          {inboxTab === "Messages" && search.trim() ? (
            <div className="mt-2 max-h-52 overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950">
              {searching ? <p className="p-3 text-sm text-zinc-500">Searching...</p> : searchResults.length ? searchResults.map((person) => (
                <button key={person.id} onClick={() => void startConversation(person)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-white/5">
                  <Avatar person={person} />
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{person.name || person.username}</span><span className="block truncate text-xs text-zinc-500">@{person.username}</span></span>
                </button>
              )) : <p className="p-3 text-sm text-zinc-500">No accounts found.</p>}
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {!userId && !inboxLoading ? <Link href="/login" className="m-4 block rounded-2xl border border-white/10 bg-zinc-900 p-4 text-center text-sm text-zinc-300">Log in to open your inbox</Link> : null}
          {error && !selectedConversationId ? <p role="alert" className="mx-4 mt-4 rounded-xl border border-pink-400/20 bg-pink-400/10 p-3 text-sm text-pink-100">{error}</p> : null}

          {inboxTab === "Status" ? (
            <section className="p-4">
              <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />}>
                <StatusBar userId={userId} />
              </Suspense>
            </section>
          ) : (
          <>
          {userId ? (
            <section className="border-b border-white/[0.06] px-4 py-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Friends</h2>
              {communityLoading ? <p className="text-xs text-zinc-500">Loading friends...</p> : friends.length ? (
                <div className="flex gap-4 overflow-x-auto pb-1">
                  {friends.map((person) => (
                    <button key={person.id} onClick={() => void startConversation(person)} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center" aria-label={`Message ${person.name || person.username}`}>
                      <Avatar person={person} />
                      <span className="w-full truncate text-[11px] text-zinc-300">{person.name || person.username}</span>
                    </button>
                  ))}
                </div>
              ) : <p className="text-xs text-zinc-500">Mutual follows will appear here.</p>}
            </section>
          ) : null}

          <section>
            <h2 className="px-4 pb-2 pt-4 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Messages{unreadTotal ? <span className="ml-2 text-violet-300">{unreadTotal} unread</span> : null}</h2>
            {inboxLoading ? <p className="px-4 py-6 text-center text-sm text-zinc-500">Loading conversations...</p> : null}
            {userId && !inboxLoading && !summaries.length ? <p className="px-4 py-5 text-sm text-zinc-500">No conversations yet. Message a friend or someone suggested below.</p> : null}
            {summaries.map((summary) => {
              const personId = summary.participant_one === userId ? summary.participant_two : summary.participant_one;
              const person = people[personId];
              const preview = summary.last_image_url ? "📷 Photo" : summary.last_body || "Start a conversation";
              return (
                <button key={summary.conversation_id} onClick={() => openConversation(summary.conversation_id, personId)} className={`flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3.5 text-left transition hover:bg-white/[0.04] ${selectedConversationId === summary.conversation_id ? "bg-violet-400/[0.08]" : ""}`}>
                  <Avatar person={person} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-white">{person?.name || person?.username || "Maestra member"}</span><time className="shrink-0 text-[10px] text-zinc-500">{formatMessageTime(summary.last_message_at)}</time></span>
                    <span className="mt-1 flex items-center justify-between gap-2"><span className={`truncate text-xs ${summary.unread_count ? "font-semibold text-zinc-200" : "text-zinc-500"}`}>{summary.last_sender_id === userId && summary.last_body ? "You: " : ""}{preview}</span>{summary.unread_count ? <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white">{summary.unread_count}</span> : null}</span>
                  </span>
                </button>
              );
            })}
          </section>

          {userId ? (
            <section className="border-t border-white/[0.06] px-4 py-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Suggested</h2>
              {communityLoading ? <p className="text-xs text-zinc-500">Finding people...</p> : suggestions.length ? (
                <div className="space-y-3">
                  {suggestions.map((person) => (
                    <article key={person.id} className="flex items-center gap-3">
                      <Avatar person={person} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{person.name || person.username}</p>
                        <p className="truncate text-xs text-zinc-500">@{person.username}</p>
                      </div>
                      <button disabled={followingBusyId === person.id} onClick={() => void followPerson(person)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-violet-400 disabled:opacity-50">
                        {followingBusyId === person.id ? "..." : "Follow"}
                      </button>
                      <button onClick={() => void startConversation(person)} className="rounded-full bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-400">Message</button>
                    </article>
                  ))}
                </div>
              ) : <p className="text-xs text-zinc-500">No new people to suggest right now.</p>}
            </section>
          ) : null}
          </>
          )}
        </div>
      </aside>

      <section className={`min-w-0 flex-1 flex-col bg-[#09061a] ${selectedConversationId ? "flex" : "hidden sm:flex"}`}>
        {selectedConversationId && otherPerson ? (
          <>
            <header className="flex h-[72px] shrink-0 items-center gap-3 border-b border-white/10 px-4">
              <button onClick={() => setSelectedConversationId(null)} aria-label="Back to inbox" className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10"><ArrowLeft className="h-5 w-5" /></button>
              <Link href={`/${otherPerson.username}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar person={otherPerson} />
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{otherPerson.name || otherPerson.username}</span><span className="block truncate text-xs text-zinc-500">@{otherPerson.username}</span></span>
              </Link>
              <button
                type="button"
                onClick={() => void exportConversation()}
                disabled={exporting}
                aria-label="Download chat history"
                title="Download chat history"
                className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-300 hover:bg-white/10 disabled:opacity-50"
              >
                <Download className="h-5 w-5" />
              </button>
            </header>

            {error ? <p role="alert" className="mx-4 mt-3 rounded-xl border border-pink-400/20 bg-pink-400/10 p-3 text-sm text-pink-100">{error}</p> : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
              {messages.map((message) => {
                const own = message.sender_id === userId;
                const imageSrc = localMediaUrls[message.id] ?? message.image_url;
                const voiceSrc = localMediaUrls[message.id] ?? message.voice_url;
                return (
                  <div key={message.id} className={`mb-3 flex ${own ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-3xl px-4 py-2.5 ${own ? "rounded-br-lg bg-violet-600 text-white" : "rounded-bl-lg border border-white/10 bg-zinc-900 text-zinc-100"}`}>
                      {imageSrc ? (
                        <a href={imageSrc} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={imageSrc} alt="Shared image" className="mb-2 max-h-72 max-w-full rounded-2xl object-cover" />
                        </a>
                      ) : null}
                      {voiceSrc ? <audio controls preload="metadata" src={voiceSrc} className="mb-2 max-w-full" aria-label="Voice message" /> : null}
                      {message.body && !(voiceSrc && message.body === "Voice message") && !(imageSrc && message.body === "Photo")
                        ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
                        : null}
                      <p className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${own ? "text-violet-100/70" : "text-zinc-500"}`}>
                        <time dateTime={message.created_at}>{formatMessageTime(message.created_at)}</time>
                        {own ? readMessageIds.has(message.id)
                          ? <CheckCheck aria-label="Read" className="h-3.5 w-3.5 text-sky-200" />
                          : <Check aria-label="Sent" className="h-3.5 w-3.5" />
                          : null}
                      </p>
                    </div>
                  </div>
                );
              })}
              {!messages.length ? <p className="m-auto max-w-xs text-center text-sm leading-relaxed text-zinc-500">Say hello to {otherPerson.name || otherPerson.username} and start your conversation.</p> : null}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-white/10 bg-[#0d0a20] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {imagePreview ? (
                <div className="relative mb-3 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Image to send" className="h-20 w-20 rounded-xl object-cover" />
                  <button onClick={() => { setImageFile(null); setImagePreview(null); }} aria-label="Remove attached image" className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-white"><X className="h-4 w-4" /></button>
                </div>
              ) : null}
              {voicePreview ? (
                <div className="mb-3 flex items-center gap-3 rounded-xl border border-violet-400/20 bg-violet-500/10 p-2">
                  <audio controls preload="metadata" src={voicePreview} className="min-w-0 flex-1" aria-label="Voice message preview" />
                  <button type="button" onClick={() => { setVoiceFile(null); setVoicePreview(null); }} aria-label="Remove voice message" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10"><X className="h-4 w-4" /></button>
                </div>
              ) : null}
              {picker ? (
                <div className="mb-3 rounded-2xl border border-white/10 bg-[#17132f] p-3">
                  <div className="mb-2 flex gap-2">
                    <button type="button" onClick={() => setPicker("emoji")} className={`rounded-full px-3 py-1 text-xs ${picker === "emoji" ? "bg-violet-500 text-white" : "text-zinc-400"}`}>Emoji</button>
                    <button type="button" onClick={() => setPicker("sticker")} className={`rounded-full px-3 py-1 text-xs ${picker === "sticker" ? "bg-violet-500 text-white" : "text-zinc-400"}`}>Stickers</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(picker === "emoji" ? QUICK_EMOJIS : QUICK_STICKERS).map((item) => (
                      <button key={item} type="button" onClick={() => setDraft((current) => `${current}${item}`)} className="min-h-10 min-w-10 rounded-xl bg-white/[0.05] px-2 text-xl hover:bg-violet-500/20">{item}</button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 text-zinc-300 hover:bg-white/5" aria-label="Attach image">
                  <ImagePlus className="h-5 w-5" />
                  <input type="file" accept="image/*" className="sr-only" disabled={recording || Boolean(voiceFile)} onChange={(event) => { chooseImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
                </label>
                <button type="button" onClick={() => setPicker((current) => current === "emoji" ? null : "emoji")} aria-label="Emoji and stickers" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 text-zinc-300 hover:bg-white/5"><Smile className="h-5 w-5" /></button>
                <button
                  type="button"
                  aria-label={recording ? "Release to finish recording" : "Hold to record a voice message"}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    recordingHeldRef.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    void startRecording();
                  }}
                  onPointerUp={stopRecording}
                  onPointerCancel={stopRecording}
                  onKeyDown={(event) => {
                    if (event.key === " " && !event.repeat) {
                      event.preventDefault();
                      recordingHeldRef.current = true;
                      void startRecording();
                    }
                  }}
                  onKeyUp={(event) => {
                    if (event.key === " ") stopRecording();
                  }}
                  onContextMenu={(event) => event.preventDefault()}
                  disabled={sending || Boolean(voiceFile) || Boolean(imageFile)}
                  className={`flex h-11 w-11 shrink-0 touch-none items-center justify-center rounded-full border ${recording ? "border-pink-300 bg-pink-500 text-white" : "border-white/10 text-zinc-300 hover:bg-white/5"} disabled:opacity-40`}
                ><Mic className="h-5 w-5" /></button>
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} maxLength={4000} placeholder="Message..." className="max-h-32 min-h-11 min-w-0 flex-1 resize-y rounded-3xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400" />
                <button onClick={() => void sendMessage()} disabled={sending || recording || (!draft.trim() && !imageFile && !voiceFile)} aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400 disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              {recording ? (
                <div role="status" className="mt-2 flex items-center gap-3 pl-14">
                  <span className="text-xs tabular-nums text-pink-200">{Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")} / 2:00</span>
                  <span className="flex h-6 flex-1 items-center gap-0.5" aria-label="Recording waveform">
                    {waveform.map((height, index) => <span key={index} className="w-1 rounded-full bg-fuchsia-300" style={{ height: `${height}%` }} />)}
                  </span>
                  <span className="text-[10px] text-zinc-500">Release to send</span>
                </div>
              ) : (
                <p className="mt-2 pl-14 text-[10px] text-zinc-600"><Sticker className="mr-1 inline h-3 w-3" />Hold mic to record · Enter to send · Shift + Enter for a new line</p>
              )}
            </div>
          </>
        ) : (
          <div className="hidden h-full flex-col items-center justify-center text-center sm:flex">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-violet-300/20 bg-violet-400/10"><MessageCircle className="h-9 w-9 text-violet-300" /></div>
            <h2 className="mt-5 text-xl font-semibold text-white">Your messages</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-500">Choose a conversation or find someone to chat with.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function Avatar({ person }: { person?: Person }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-sm font-bold text-white">
      {person?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : person ? avatarLabel(person) : "MV"}
    </span>
  );
}
