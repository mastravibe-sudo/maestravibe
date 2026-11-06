"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, Music2, Plus, Send, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/media/compress";
import { requestActivityPush } from "@/lib/notifications/client";
import { subscribeWithRecovery } from "@/lib/supabase/realtime";

type Status = {
  id: string;
  user_id: string;
  text: string;
  image_url: string | null;
  music_url: string | null;
  music_duration: number | null;
  created_at: string;
  expires_at: string;
};
type Person = { id: string; username: string; name: string | null; avatar_url: string | null };
type StatusGroup = { person: Person; statuses: Status[] };
type StatusViewer = { person: Person; viewed_at: string };

const MAX_IMAGE_BYTES = 150 * 1024;
const MAX_MUSIC_BYTES = 10 * 1024 * 1024;
const inputClass = "w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-violet-400";

function readAudioDuration(file: File) {
  return new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (!Number.isFinite(audio.duration)) reject(new Error("Could not read the MP3 duration."));
      else resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Choose a valid MP3 audio file."));
    };
    audio.src = url;
  });
}

async function uploadStatusFile(file: Blob, purpose: "status-image" | "status-music", filename: string) {
  const form = new FormData();
  form.append("purpose", purpose);
  form.append("file", file, filename);
  const response = await fetch("/api/upload", { method: "POST", body: form });
  const result = await response.json() as { publicUrl?: string; error?: string };
  if (!response.ok || !result.publicUrl) throw new Error(result.error ?? "Upload failed.");
  return result.publicUrl;
}

function Avatar({ person, hasStatus, onClick }: { person: Person; hasStatus: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-[76px] shrink-0 flex-col items-center gap-2 text-center">
      <span className={`flex h-[68px] w-[68px] items-center justify-center rounded-full p-[3px] ${hasStatus ? "bg-gradient-to-tr from-amber-400 via-fuchsia-500 to-violet-500" : "bg-zinc-700"}`}>
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-[3px] border-[#09061a] bg-zinc-800 text-lg font-bold text-white">
          {person.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (person.name || person.username).slice(0, 1).toUpperCase()}
        </span>
      </span>
      <span className="w-full truncate text-[11px] text-zinc-300 group-hover:text-white">{person.name || person.username}</span>
    </button>
  );
}

export default function StatusBar({ userId }: { userId: string | null }) {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStatusId = searchParams.get("status");
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [profile, setProfile] = useState<Person | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [musicDuration, setMusicDuration] = useState<number | null>(null);
  const [viewingGroup, setViewingGroup] = useState<StatusGroup | null>(null);
  const [viewingIndex, setViewingIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [realtimeDisconnected, setRealtimeDisconnected] = useState(false);
  const [statusViewers, setStatusViewers] = useState<StatusViewer[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);
  const status = viewingGroup?.statuses[viewingIndex] ?? null;

  const loadStatuses = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      setProfile(null);
      return;
    }
    setLoading(true);
    const { data: ownProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id,username,name,avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }
    setProfile(ownProfile as Person | null);

    const { data: followRows, error: followsError } = await supabase
      .from("follows")
      .select("followed_id")
      .eq("follower_id", userId);
    if (followsError) {
      setError(followsError.message);
      setLoading(false);
      return;
    }
    const visibleIds = [userId, ...(followRows ?? []).map((row) => row.followed_id as string)];
    const { data: statusRows, error: statusesError } = await supabase
      .from("statuses")
      .select("id,user_id,text,image_url,music_url,music_duration,created_at,expires_at")
      .in("user_id", visibleIds)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(300);
    if (statusesError) {
      setError(statusesError.message);
      setGroups([]);
      setLoading(false);
      return;
    }

    const rows = (statusRows ?? []) as Status[];
    const personIds = [...new Set(rows.map((row) => row.user_id))];
    const { data: people, error: peopleError } = personIds.length
      ? await supabase.from("profiles").select("id,username,name,avatar_url").in("id", personIds)
      : { data: [], error: null };
    if (peopleError) setError(peopleError.message);
    const personById = new Map(((people ?? []) as Person[]).map((person) => [person.id, person]));
    const grouped = new Map<string, Status[]>();
    for (const row of rows) grouped.set(row.user_id, [...(grouped.get(row.user_id) ?? []), row]);
    const result = [...grouped.entries()].flatMap(([id, statuses]) => {
      const person = personById.get(id);
      return person ? [{ person, statuses }] : [];
    });
    result.sort((a, b) => {
      if (a.person.id === userId) return -1;
      if (b.person.id === userId) return 1;
      return b.statuses[b.statuses.length - 1].created_at.localeCompare(a.statuses[a.statuses.length - 1].created_at);
    });
    setGroups(result);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatuses();
    const unsubscribe = subscribeWithRecovery({
      supabase,
      channelName: `statuses-${userId}`,
      configure: (channel) => channel
        .on("postgres_changes", { event: "*", schema: "public", table: "statuses" }, () => void loadStatuses()),
      onDisconnected: () => setRealtimeDisconnected(true),
      onReconnected: () => setRealtimeDisconnected(false),
    });
    const expiryTimer = window.setInterval(() => void loadStatuses(), 60_000);
    return () => {
      window.clearInterval(expiryTimer);
      unsubscribe();
    };
  }, [loadStatuses, supabase, userId]);

  useEffect(() => {
    if (imagePreview) return () => URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => {
    if (!status?.music_url || !audioRef.current) return;
    void audioRef.current.play().catch(() => {
      setError("Tap play to hear this status's music.");
    });
  }, [status?.id, status?.music_url]);

  useEffect(() => {
    if (!requestedStatusId || !groups.length) return;
    const group = groups.find((candidate) => candidate.statuses.some((item) => item.id === requestedStatusId));
    if (!group) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setViewingGroup(group);
      setViewingIndex(group.statuses.findIndex((item) => item.id === requestedStatusId));
      router.replace("/inbox", { scroll: false });
    });
    return () => { active = false; };
  }, [groups, requestedStatusId, router]);

  const statusId = status?.id;
  const statusOwnerId = status?.user_id;
  useEffect(() => {
    let active = true;
    if (!statusId || !statusOwnerId || !userId) {
      queueMicrotask(() => {
        if (active) setStatusViewers([]);
      });
      return () => { active = false; };
    }

    const loadViewers = async () => {
      if (statusOwnerId !== userId) {
        setStatusViewers([]);
        const { error: viewError } = await supabase.from("status_views").insert({ status_id: statusId, viewer_id: userId });
        if (viewError && viewError.code !== "23505" && active) setError(viewError.message);
        return;
      }

      const { data: views, error: viewsError } = await supabase
        .from("status_views")
        .select("viewer_id,viewed_at")
        .eq("status_id", statusId)
        .order("viewed_at", { ascending: false });
      if (viewsError) {
        if (active) setError(viewsError.message);
        return;
      }
      const viewerIds = [...new Set((views ?? []).map((view) => view.viewer_id as string))];
      if (!viewerIds.length) {
        if (active) setStatusViewers([]);
        return;
      }
      const { data: people, error: peopleError } = await supabase
        .from("profiles")
        .select("id,username,name,avatar_url")
        .in("id", viewerIds);
      if (peopleError) {
        if (active) setError(peopleError.message);
        return;
      }
      const personById = new Map(((people ?? []) as Person[]).map((person) => [person.id, person]));
      if (active) setStatusViewers((views ?? []).flatMap((view) => {
        const person = personById.get(view.viewer_id as string);
        return person ? [{ person, viewed_at: view.viewed_at as string }] : [];
      }));
    };

    void loadViewers();
    return () => { active = false; };
  }, [statusId, statusOwnerId, supabase, userId]);

  const statusCount = useMemo(() => groups.reduce((count, group) => count + group.statuses.length, 0), [groups]);
  const ownStatus = groups.find((group) => group.person.id === userId);
  if (!userId) return null;

  const resetComposer = () => {
    setComposerOpen(false);
    setDraft("");
    setImageFile(null);
    setImagePreview(null);
    setMusicFile(null);
    setMusicDuration(null);
    setError(null);
  };

  const selectImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setError(null);
  };

  const selectMusic = async (file?: File) => {
    if (!file) return;
    if (file.type !== "audio/mpeg" && !file.name.toLowerCase().endsWith(".mp3")) {
      setError("Choose an MP3 file.");
      return;
    }
    if (file.size > MAX_MUSIC_BYTES) {
      setError("MP3 files must be 10 MB or smaller.");
      return;
    }
    try {
      const duration = await readAudioDuration(file);
      if (duration > 30) throw new Error("Choose a clip that is 30 seconds or shorter.");
      setMusicFile(file);
      setMusicDuration(duration);
      setError(null);
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : "Could not read this MP3.");
    }
  };

  const publishStatus = async () => {
    if (!userId || (!draft.trim() && !imageFile) || saving) return;
    setSaving(true);
    setError(null);
    try {
      let imageUrl: string | null = null;
      let musicUrl: string | null = null;
      if (imageFile) {
        const compressed = await compressImage(imageFile, MAX_IMAGE_BYTES);
        imageUrl = await uploadStatusFile(compressed, "status-image", "status.webp");
      }
      if (musicFile) musicUrl = await uploadStatusFile(musicFile, "status-music", "status.mp3");

      const { data: createdStatus, error: insertError } = await supabase.from("statuses").insert({
        user_id: userId,
        text: draft.trim(),
        image_url: imageUrl,
        music_url: musicUrl,
        music_duration: musicDuration,
      }).select("id").single();
      if (insertError) throw new Error(insertError.message);
      resetComposer();
      await loadStatuses();
      const pushError = await requestActivityPush({ type: "status", statusId: createdStatus.id });
      if (pushError) setError(pushError);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : "Could not post your status.");
    } finally {
      setSaving(false);
    }
  };

  const openGroup = (group: StatusGroup) => {
    setViewingGroup(group);
    setViewingIndex(0);
  };

  const nextStatus = () => {
    if (!viewingGroup) return;
    if (viewingIndex + 1 < viewingGroup.statuses.length) setViewingIndex((index) => index + 1);
    else setViewingGroup(null);
  };

  const previousStatus = () => {
    if (viewingIndex > 0) setViewingIndex((index) => index - 1);
    else setViewingGroup(null);
  };

  const deleteStatus = async () => {
    if (!status || status.user_id !== userId) return;
    const { error: deleteError } = await supabase.from("statuses").delete().eq("id", status.id).eq("user_id", userId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    const remaining = viewingGroup?.statuses.filter((item) => item.id !== status.id) ?? [];
    if (!remaining.length && viewingGroup) setViewingGroup(null);
    else if (viewingGroup) setViewingGroup({ ...viewingGroup, statuses: remaining });
    await loadStatuses();
  };

  return (
    <>
      <section aria-label="Statuses" className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#141028] px-2.5 py-3">
        <div className="flex gap-3 overflow-x-auto pb-1">
          <div className="flex w-[76px] shrink-0 flex-col items-center gap-2">
            <div className="relative h-[68px] w-[68px]">
              <button onClick={() => ownStatus ? openGroup(ownStatus) : setComposerOpen(true)} aria-label={ownStatus ? "View your status" : "Post a status"} className={`flex h-full w-full items-center justify-center rounded-full border-2 text-violet-200 ${ownStatus ? "border-transparent bg-gradient-to-tr from-amber-400 via-fuchsia-500 to-violet-500" : "border-dashed border-violet-300/70 bg-violet-500/10 hover:bg-violet-500/20"}`}>
                {ownStatus ? (
                  <span className="h-[58px] w-[58px] overflow-hidden rounded-full border-[3px] border-[#09061a] bg-zinc-800">
                    {profile?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : <span className="flex h-full w-full items-center justify-center text-lg font-bold">{profile ? (profile.name || profile.username).slice(0, 1).toUpperCase() : "+"}</span>}
                  </span>
                ) : <Plus className="h-7 w-7" />}
              </button>
              <button onClick={() => setComposerOpen(true)} aria-label="Add a status" className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#141028] bg-violet-500 text-white"><Plus className="h-4 w-4" /></button>
            </div>
            <span className="w-full truncate text-center text-[11px] text-zinc-300">Your status</span>
          </div>
          {groups.filter((group) => group.person.id !== userId).map((group) => (
            <Avatar key={group.person.id} person={group.person} hasStatus onClick={() => openGroup(group)} />
          ))}
          {loading && !statusCount ? <span className="self-center text-xs text-zinc-500">Loading statuses...</span> : null}
          {!loading && groups.length === 0 ? <span className="self-center text-xs text-zinc-500">Share a moment that disappears in 24 hours.</span> : null}
        </div>
        {error && !composerOpen && !viewingGroup ? <p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-950/30 p-2 text-xs text-red-200">{error}</p> : null}
        {realtimeDisconnected ? <p role="status" className="mt-3 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-200">Reconnecting to status updates…</p> : null}
      </section>

      {composerOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) resetComposer(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="status-composer-title" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#100c24] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]">
            <header className="mb-4 flex items-center justify-between">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">24-hour update</p><h2 id="status-composer-title" className="mt-1 text-xl font-bold text-white">Post a status</h2></div>
              <button onClick={resetComposer} aria-label="Close status composer" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-zinc-300"><X className="h-5 w-5" /></button>
            </header>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={280} rows={4} placeholder="What are you up to?" className={`${inputClass} resize-none`} />
            <p className="mt-1 text-right text-[11px] text-zinc-500">{draft.length}/280</p>
            {imagePreview ? (
              <div className="relative mt-3 overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Status preview" className="max-h-64 w-full object-cover" />
                <button onClick={() => { setImageFile(null); setImagePreview(null); }} aria-label="Remove status image" className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white"><X className="h-4 w-4" /></button>
              </div>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 text-sm text-zinc-200 hover:bg-white/5">
                <ImagePlus className="h-4 w-4 text-violet-300" />{imageFile ? "Change image" : "Add image"}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => { selectImage(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
              <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 text-sm text-zinc-200 hover:bg-white/5">
                <Music2 className="h-4 w-4 text-pink-300" />{musicFile ? `${musicFile.name.slice(0, 15)}${musicDuration ? ` · ${Math.ceil(musicDuration)}s` : ""}` : "Add MP3"}
                <input type="file" accept=".mp3,audio/mpeg" className="sr-only" onChange={(event) => { void selectMusic(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
              </label>
            </div>
            {error ? <p role="alert" className="mt-3 rounded-xl border border-red-400/20 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}
            <p className="mt-3 text-xs text-zinc-500">Images are optimized before upload. MP3: 10 MB max, 30 seconds max.</p>
            <button onClick={() => void publishStatus()} disabled={saving || (!draft.trim() && !imageFile)} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-blue-500 px-4 text-sm font-bold text-white disabled:opacity-40">
              <Send className="h-4 w-4" />{saving ? "Posting..." : "Share status"}
            </button>
          </section>
        </div>
      ) : null}

      {viewingGroup && status ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-6" onClick={() => setViewingGroup(null)}>
          <section role="dialog" aria-modal="true" aria-label={`${viewingGroup.person.name || viewingGroup.person.username}'s status`} className="relative flex h-[min(82dvh,760px)] w-full max-w-md flex-col overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="absolute inset-x-3 top-3 z-20 flex gap-1">
              {viewingGroup.statuses.map((item, index) => <span key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30"><span className={`block h-full ${index <= viewingIndex ? "bg-white" : "bg-transparent"}`} /></span>)}
            </div>
            <header className="absolute inset-x-0 top-5 z-20 flex items-center gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-8 pt-3">
              <Avatar person={viewingGroup.person} hasStatus onClick={() => undefined} />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{viewingGroup.person.name || viewingGroup.person.username}</p><p className="text-xs text-white/70">{new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(status.created_at))}</p></div>
              {status.user_id === userId ? <button onClick={() => void deleteStatus()} aria-label="Delete status" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white"><Trash2 className="h-4 w-4" /></button> : null}
              <button onClick={() => setViewingGroup(null)} aria-label="Close status" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white"><X className="h-5 w-5" /></button>
            </header>
            <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center bg-gradient-to-br from-violet-950 via-zinc-900 to-fuchsia-950">
              {status.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={status.image_url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />
              ) : null}
              <div className="pointer-events-none absolute inset-0 bg-black/25" />
              <p className="relative z-10 max-h-[60%] overflow-y-auto whitespace-pre-wrap break-words px-8 text-center text-2xl font-semibold leading-relaxed text-white drop-shadow-lg">{status.text}</p>
            </div>
            {status.music_url ? (
              <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-5">
                <audio ref={audioRef} key={status.id} src={status.music_url} controls autoPlay className="h-10 w-full max-w-sm" />
              </div>
            ) : null}
            {status.user_id === userId ? (
              <div className={`absolute inset-x-3 z-20 max-h-24 overflow-y-auto rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur ${status.music_url ? "bottom-16" : "bottom-3"}`}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/70">Viewed by {statusViewers.length}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {statusViewers.map(({ person, viewed_at }) => (
                    <span key={person.id} title={new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(viewed_at))} className="flex items-center gap-1.5 text-xs text-white/90">
                      {person.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={person.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                      ) : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[9px]">{(person.name || person.username).slice(0, 1).toUpperCase()}</span>}
                      {person.name || `@${person.username}`}
                    </span>
                  ))}
                  {!statusViewers.length ? <span className="text-xs text-white/60">No views yet</span> : null}
                </div>
              </div>
            ) : null}
            <button aria-label="Previous status" onClick={previousStatus} className="absolute inset-y-20 left-0 z-10 w-1/3" />
            <button aria-label="Next status" onClick={nextStatus} className="absolute inset-y-20 right-0 z-10 w-1/3" />
          </section>
        </div>
      ) : null}
    </>
  );
}
