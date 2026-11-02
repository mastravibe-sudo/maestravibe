"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CheckCheck, ImagePlus, MessageCircle, MoreHorizontal, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/media/compress";
import { useCurrentUser } from "@/components/CurrentUserContext";
import { requestActivityPush } from "@/lib/notifications/client";

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
type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
};

const fieldClass = "w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400";
const avatarLabel = (person: Person) => (person.name || person.username).slice(0, 1).toUpperCase();
const formatMessageTime = (date: string) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(date));

async function uploadChatImage(file: File) {
  const image = await compressImage(file, 150 * 1024);
  const form = new FormData();
  form.append("purpose", "post");
  form.append("file", image, "message.webp");
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const result = await response.json() as { publicUrl?: string; error?: string };
  if (!response.ok || !result.publicUrl) throw new Error(result.error ?? "Image upload failed.");
  return result.publicUrl;
}

export default function InboxPage() {
  const [supabase] = useState(() => createClient());
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
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [communityLoading, setCommunityLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [followingBusyId, setFollowingBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
    const { data, error: messagesError } = await supabase
      .from("messages")
      .select("id,conversation_id,sender_id,body,image_url,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    if (messagesError) {
      setError(messagesError.message);
      return;
    }

    const rows = (data ?? []) as Message[];
    setMessages(rows);
    const ids = rows.map((message) => message.id);
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
    const channel = supabase
      .channel(`inbox-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as Partial<Message>;
        if (row.conversation_id === selectedConversationId && selectedConversationId) void loadMessages(selectedConversationId);
        void loadSummaries();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reads" }, (payload) => {
        const row = (payload.new ?? payload.old) as { conversation_id?: string };
        if (row.conversation_id === selectedConversationId && selectedConversationId) void loadMessages(selectedConversationId);
        void loadSummaries();
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setError("Inbox updates disconnected. Refresh to reconnect.");
      });
    return () => { void supabase.removeChannel(channel); };
  }, [loadMessages, loadSummaries, selectedConversationId, supabase, userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    if (imagePreview) return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

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

  const startConversation = async (person: Person) => {
    if (!userId || person.id === userId) return;
    setError(null);
    const [participantOne, participantTwo] = [userId, person.id].sort();
    const existing = summaries.find((summary) =>
      summary.participant_one === participantOne && summary.participant_two === participantTwo
    );
    if (existing) {
      openConversation(existing.conversation_id);
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
          openConversation(raced.id);
        } else setError("That conversation could not be opened. Refresh and try again.");
      } else setError(createError.message);
      return;
    }
    setPeople((current) => ({ ...current, [person.id]: person }));
    setSearch("");
    setSearchResults([]);
    await loadSummaries();
    openConversation(data.id);
  };

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

  const openConversation = (conversationId: string) => {
    setMessages([]);
    setReadMessageIds(new Set());
    setSelectedConversationId(conversationId);
    void loadMessages(conversationId);
  };

  const updateSearch = (value: string) => {
    setSearch(value);
    if (value.trim().replace(/^@/, "").replace(/[^a-zA-Z0-9_.-]/g, "").length < 2) setSearchResults([]);
  };

  const chooseImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setError(null);
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const sendMessage = async () => {
    if (!userId || !selectedConversationId || (!draft.trim() && !imageFile) || sending) return;
    setSending(true);
    setError(null);
    try {
      const imageUrl = imageFile ? await uploadChatImage(imageFile) : null;
      const { data: sentMessage, error: sendError } = await supabase.from("messages").insert({
        conversation_id: selectedConversationId,
        sender_id: userId,
        body: draft.trim(),
        image_url: imageUrl,
      }).select("id").single();
      if (sendError) throw new Error(sendError.message);
      setDraft("");
      setImageFile(null);
      setImagePreview(null);
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
    <main className="mx-auto flex h-[calc(100dvh-5rem)] max-w-7xl overflow-hidden border-x border-white/10 bg-[#09061a] text-zinc-100 md:h-dvh">
      <aside className={`flex w-full shrink-0 flex-col border-r border-white/10 bg-[#0e0b20] sm:w-[340px] lg:w-[390px] ${selectedConversationId ? "hidden sm:flex" : "flex"}`}>
        <header className="border-b border-white/10 px-4 pb-4 pt-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">Messages</p>
              <h1 className="mt-1 text-2xl font-bold text-white">Inbox{unreadTotal ? <span className="ml-2 text-sm font-semibold text-violet-300">{unreadTotal}</span> : null}</h1>
            </div>
            <MessageCircle className="h-6 w-6 text-violet-300" />
          </div>
          <input value={search} onChange={(event) => updateSearch(event.target.value)} placeholder="Find someone by username" aria-label="Find someone by username" className={fieldClass} />
          {search.trim() ? (
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
          {error && !selectedConversationId ? <p role="alert" className="mx-4 mt-4 rounded-xl border border-red-400/20 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}

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
                <button key={summary.conversation_id} onClick={() => openConversation(summary.conversation_id)} className={`flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3.5 text-left transition hover:bg-white/[0.04] ${selectedConversationId === summary.conversation_id ? "bg-violet-400/[0.08]" : ""}`}>
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
              <MoreHorizontal aria-hidden="true" className="h-5 w-5 text-zinc-500" />
            </header>

            {error ? <p role="alert" className="mx-4 mt-3 rounded-xl border border-red-400/20 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5">
              {messages.map((message) => {
                const own = message.sender_id === userId;
                return (
                  <div key={message.id} className={`mb-3 flex ${own ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] rounded-3xl px-4 py-2.5 ${own ? "rounded-br-lg bg-violet-600 text-white" : "rounded-bl-lg border border-white/10 bg-zinc-900 text-zinc-100"}`}>
                      {message.image_url ? (
                        <a href={message.image_url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={message.image_url} alt="Shared image" className="mb-2 max-h-72 max-w-full rounded-2xl object-cover" />
                        </a>
                      ) : null}
                      {message.body ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p> : null}
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
              <div className="flex items-end gap-2">
                <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-white/10 text-zinc-300 hover:bg-white/5" aria-label="Attach image">
                  <ImagePlus className="h-5 w-5" />
                  <input type="file" accept="image/*" className="sr-only" onChange={(event) => { chooseImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
                </label>
                <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} maxLength={4000} placeholder="Message..." className="max-h-32 min-h-11 min-w-0 flex-1 resize-y rounded-3xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400" />
                <button onClick={() => void sendMessage()} disabled={sending || (!draft.trim() && !imageFile)} aria-label="Send message" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white transition hover:bg-violet-400 disabled:opacity-40">
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 pl-14 text-[10px] text-zinc-600">Enter to send · Shift + Enter for a new line</p>
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
