"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { Bookmark, Clapperboard, ExternalLink, Flame, ImagePlus, MessageCircle, Play, Repeat2, Share2, ShoppingBag, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { typeMeta } from "@/components/postMeta";
import { Avatar, ago, mediaOf, type Orig, type Row } from "@/components/postUtils";
import { diversifyFeed, rankVideos } from "@/lib/feed/rank";
import { requestActivityPush as sendActivityPush } from "@/lib/notifications/client";
import { activateVideo, deactivateVideo, hasActiveVideo, isVideoActive } from "@/lib/activeVideo";


const ShortsViewer = dynamic(() => import("@/components/ShortsViewer"), { loading: () => null });
const PostViewer = dynamic(() => import("@/components/PostViewer"), { loading: () => null });
const CommentsSheet = dynamic(() => import("@/components/CommentsSheet"), { loading: () => null });

const SELECT =
  "id,type,title,body,tags,location,media,image_url,created_at,user_id,comment_policy,comments_closed,share_policy,repost_of," +
  "profiles!posts_user_id_fkey(username,name,avatar_url,style),vibes(user_id,kind),saves(user_id)," +
  "comments(id,body,pinned,created_at,user_id,profiles!comments_user_id_fkey(username,name,avatar_url))";
const ORIG = "id,title,body,image_url,media,profiles!posts_user_id_fkey(username,name,avatar_url)";
const BRAND = "bg-linear-to-r from-violet-600 via-fuchsia-500 to-blue-500";
const card = "overflow-hidden rounded-xl border border-white/[0.06] bg-[#110f2e]";
const act = "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-base text-[#c9c4e8] hover:bg-white/10 active:scale-95 disabled:opacity-40";
const TABS = ["For You", "Following"] as const;
const POSTS_PER_PAGE = 20;
type LikeOverride = { liked: boolean; delta: number; kind: string };
const isShortMedia = (r: Row) => {
  const media = mediaOf(r.original ?? r)[0];
  return media?.type === "video" || media?.type === "image";
};
type MarketProduct = { id: string; title: string; price: number; currency: string; image_url: string | null; url: string; in_stock: boolean };
const EMPTY_IDS: string[] = [];

export default function DbFeed({ circleCard, discoverCard }: { circleCard?: ReactNode; discoverCard?: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const feedRef = useRef<HTMLElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("For You");
  const [loading, setLoading] = useState(true);
  const [shorts, setShorts] = useState(false);
  const [initialShortId, setInitialShortId] = useState<string | null>(null);
  const [initialShortIndex, setInitialShortIndex] = useState(0);
  const [watched, setWatched] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const [openId, setOpenId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState(false);
  const [commentsId, setCommentsId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [likeOverrides, setLikeOverrides] = useState<Record<string, LikeOverride>>({});
  const likeOverridesRef = useRef(likeOverrides);
  useLayoutEffect(() => {
  likeOverridesRef.current = likeOverrides;
}, [likeOverrides]);
  const [likePopId, setLikePopId] = useState<string | null>(null);
  const [likeToast, setLikeToast] = useState("");
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [marketError, setMarketError] = useState("");
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const postsPage = useRef(0);
  const loadingPostsPage = useRef(false);
  const deepLinked = useRef(false);
  const pendingLikes = useRef(new Set<string>());
  const likeToastTimer = useRef<number | null>(null);
  const likePopTimer = useRef<number | null>(null);
  const watchedKey = `mv-short-watched:${me ?? "guest"}`;

  const flash = useCallback((t: string) => { setNote(t); setTimeout(() => setNote(""), 2200); }, []);
  const toastLikeError = useCallback((message: string) => {
    setLikeToast(message);
    if (likeToastTimer.current !== null) window.clearTimeout(likeToastTimer.current);
    likeToastTimer.current = window.setTimeout(() => setLikeToast(""), 2600);
  }, []);
  const fail = useCallback((e: unknown) => {
    const m = (e as { message?: string })?.message ?? "Something went wrong.";
    setError(/row-level security|permission denied/i.test(m) ? "The author has limited this action on the post." : m);
  }, []);

  const load = useCallback(async () => {
    const [authResult, postsResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("posts").select(SELECT).order("created_at", { ascending: false }).range(0, POSTS_PER_PAGE - 1),
    ]);
    const user = authResult.data.user;
    setMe(user?.id ?? null);
    const nextWatchedKey = `mv-short-watched:${user?.id ?? "guest"}`;
    setWatched((current) => {
      if (current.key === nextWatchedKey) return current;
      try {
        const stored: unknown = JSON.parse(localStorage.getItem(nextWatchedKey) ?? "[]");
        const ids = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
        return { key: nextWatchedKey, ids };
      } catch {
        return { key: nextWatchedKey, ids: [] };
      }
    });
    if (user) {
      const { data: f } = await supabase.from("follows").select("followed_id").eq("follower_id", user.id);
      setFollowing((f ?? []).map((x) => x.followed_id as string));
    } else {
      setFollowing([]);
    }
    const { data, error: err } = postsResult;
    if (err) {
      setError(/column|schema cache/i.test(err.message) ? "Database update needed: run post_settings.sql and reactions.sql from supabase/migrations in the Supabase SQL Editor." : err.message);
      setLoading(false);
      return;
    }
    const list = (data as unknown as Row[]) ?? [];
    postsPage.current = list.length;
    setHasMorePosts(list.length === POSTS_PER_PAGE);
    const ids = [...new Set(list.map((r) => r.repost_of).filter((x): x is string => !!x))];
    if (ids.length) {
      const { data: originals } = await supabase.from("posts").select(ORIG).in("id", ids);
      const map = new Map(((originals ?? []) as unknown as Orig[]).map((o) => [o.id, o]));
      list.forEach((r) => { r.original = r.repost_of ? map.get(r.repost_of) ?? null : null; });
    }
    setRows(list);
    likeOverridesRef.current = {};
    setLikeOverrides({});
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    try { setHidden(JSON.parse(localStorage.getItem("mv-hidden") ?? "[]")); } catch { /* ignore */ }
  }, [load]);

  useEffect(() => () => {
    if (likeToastTimer.current !== null) window.clearTimeout(likeToastTimer.current);
    if (likePopTimer.current !== null) window.clearTimeout(likePopTimer.current);
  }, []);

  useEffect(() => {
    const refreshFeed = () => void load();
    window.addEventListener("mv:post-published", refreshFeed);
    return () => {
      window.removeEventListener("mv:post-published", refreshFeed);
    };
  }, [load]);

  useEffect(() => {
    let active = true;
    void fetch("/api/market/products")
      .then(async (response) => {
        const page = await response.json() as { items?: MarketProduct[]; error?: string };
        if (!response.ok) throw new Error(page.error || "Market products are temporarily unavailable.");
        if (active) setProducts(Array.isArray(page.items) ? page.items.slice(0, 3) : []);
      })
      .catch((loadError: unknown) => {
        if (active) setMarketError(loadError instanceof Error ? loadError.message : "Market products are temporarily unavailable.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (deepLinked.current || !rows.length) return;
    deepLinked.current = true;
    const id = new URLSearchParams(window.location.search).get("post");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id && rows.some((r) => r.id === id)) setOpenId(id);
  }, [rows]);

  const run = useCallback(async (job: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: err } = await job;
    if (err) fail(err);
    await load();
  }, [fail, load]);
  const need = useCallback(() => setError("Log in to do that."), []);
  const requestActivityPush = async (activity: { type: "vibe" | "comment"; postId: string }) => {
    const pushError = await sendActivityPush(activity);
    if (pushError) setError(pushError);
  };

  const react = useCallback(async (r: Row, kind: "vibe" | "support" | "inspire" = "vibe") => {
    if (!me) {
      need();
      return;
    }
    if (pendingLikes.current.has(r.id)) return;
    pendingLikes.current.add(r.id);
    const mine = r.vibes.find((v) => v.user_id === me);
    const previous = likeOverridesRef.current[r.id];
    const wasLiked = previous?.liked ?? Boolean(mine);
    const previousKind = previous?.kind ?? mine?.kind ?? "vibe";
    const willLike = !wasLiked || previousKind !== kind;
    const delta = (willLike ? 1 : 0) - (wasLiked ? 1 : 0);
    const nextOverride = {
      liked: willLike,
      delta: (previous?.delta ?? 0) + delta,
      kind,
    };
    likeOverridesRef.current = { ...likeOverridesRef.current, [r.id]: nextOverride };
    setLikeOverrides((current) => ({ ...current, [r.id]: nextOverride }));
    setLikePopId(r.id);
    if (likePopTimer.current !== null) window.clearTimeout(likePopTimer.current);
    likePopTimer.current = window.setTimeout(() => setLikePopId(null), 260);

    try {
      if (mine) {
        const { error: deleteError } = await supabase.from("vibes").delete().eq("post_id", r.id).eq("user_id", me);
        if (deleteError) throw deleteError;
      }
      if (willLike) {
        const { error: insertError } = await supabase.from("vibes").insert({ post_id: r.id, user_id: me, kind });
        if (insertError) throw insertError;
        if (!wasLiked) {
          void sendActivityPush({ type: "vibe", postId: r.id }).then((pushError) => {
            if (pushError) toastLikeError(pushError);
          });
        }
      }
    } catch (likeError) {
      const restored = { ...likeOverridesRef.current };
      if (previous) restored[r.id] = previous;
      else delete restored[r.id];
      likeOverridesRef.current = restored;
      setLikeOverrides(restored);
      toastLikeError(likeError instanceof Error ? likeError.message : "Could not update your vibe.");
    } finally {
      pendingLikes.current.delete(r.id);
    }
  }, [me, need, supabase, toastLikeError]);
  const vibe = useCallback((r: Row) => {
    void react(r, r.type === "struggle" ? "support" : "vibe");
  }, [react]);
  const save = useCallback((r: Row) => !me ? need() : run(r.saves.some((s) => s.user_id === me) ? supabase.from("saves").delete().eq("post_id", r.id).eq("user_id", me) : supabase.from("saves").insert({ post_id: r.id, user_id: me })), [me, need, run, supabase]);
  const repost = useCallback(async (r: Row) => {
    if (!me) return need();
    await run(supabase.from("posts").insert({ user_id: me, type: r.type, body: "", repost_of: r.repost_of ?? r.id }));
    flash("Reposted to your profile");
  }, [flash, me, need, run, supabase]);
  const refreshRow = useCallback(async (id: string) => {
    const { data, error: refreshError } = await supabase.from("posts").select(SELECT).eq("id", id).maybeSingle();
    if (refreshError || !data) return;
    const fresh = data as unknown as Row;
    setRows((current) => current.map((r) => r.id === id ? { ...fresh, original: r.original } : r));
  }, [supabase]);
  const comment = useCallback(async (r: Row, body: string) => {
    if (!me) return need();
    const { error: commentError } = await supabase.from("comments").insert({ post_id: r.id, user_id: me, body });
    if (commentError) return fail(commentError);
    void requestActivityPush({ type: "comment", postId: r.id });
    await refreshRow(r.id);
  }, [fail, me, need, refreshRow, supabase]);
  const hide = useCallback((r: Row) => {
    const next = [...hidden, r.id];
    setHidden(next);
    try { localStorage.setItem("mv-hidden", JSON.stringify(next)); } catch { /* ignore */ }
  }, [hidden]);
  const report = useCallback(async (r: Row, reason: string) => {
    if (!me) return need();
    await run(supabase.from("reports").insert({ reporter_id: me, post_id: r.id, reason: reason.slice(0, 300) }));
    hide(r);
    flash("Thanks. We will review this post.");
  }, [flash, hide, me, need, run, supabase]);
  const remove = useCallback(async (r: Row) => { setOpenId(null); await run(supabase.from("posts").delete().eq("id", r.id)); }, [run, supabase]);
  const toggleComments = useCallback((r: Row) => run(supabase.from("posts").update({ comment_policy: r.comment_policy === "off" ? "everyone" : "off" }).eq("id", r.id)), [run, supabase]);
  const share = useCallback(async (r: Row) => {
    const url = `${window.location.origin}/p/${r.id}`;
    if (navigator.share) { try { await navigator.share({ title: r.title || "Maestra Vibe", url }); return; } catch { /* user cancelled */ } }
    await navigator.clipboard?.writeText(url);
    flash("Link copied");
  }, [flash]);

  const notHidden = useMemo(() => rows.filter((r) => !hidden.includes(r.id)), [rows, hidden]);
  const visible = useMemo(
    () => notHidden.filter((r) => tab === "Following" ? r.user_id === me || following.includes(r.user_id) : true),
    [notHidden, tab, me, following]
  );
  const feedRows = useMemo(() => diversifyFeed(visible), [visible]);
  const watchedIds = useMemo(
    () => watched.key === watchedKey ? watched.ids : EMPTY_IDS,
    [watched.key, watched.ids, watchedKey],
  );
  const rankedShorts = useMemo(
    () => rankVideos(notHidden.filter(isShortMedia), { followedIds: following, watchedIds }),
    [notHidden, following, watchedIds]
  );
  const shortsViewerRows = useMemo(
    () => tab === "Following"
      ? rankVideos(visible.filter(isShortMedia), { followedIds: following, watchedIds })
      : rankedShorts,
    [following, rankedShorts, tab, visible, watchedIds],
  );
  const shortsAt = useMemo(() => {
    const placements = new Map<number, Row[]>();
    const used = new Set<string>();
    if (tab === "Following") {
      for (let postCount = 6; postCount <= feedRows.length; postCount += 6) {
        const strip = rankedShorts.filter((row) => !used.has(row.id)).slice(0, 8);
        strip.forEach((row) => used.add(row.id));
        if (strip.length) placements.set(postCount, strip);
      }
    }
    return placements;
  }, [feedRows.length, rankedShorts, tab]);
  const marketAt = useMemo(() => {
    const placements = new Map<number, MarketProduct>();
    for (let i = 0; i < products.length; i += 1) {
      const postCount = (i + 1) * 8;
      if (postCount <= feedRows.length) placements.set(postCount, products[i]);
    }
    return placements;
  }, [feedRows.length, products]);
  const openShorts = useCallback((initialId: string | null = null) => {
    setInitialShortIndex(initialId ? shortsViewerRows.findIndex((row) => row.id === initialId) : 0);
    setInitialShortId(initialId);
    setShorts(true);
  }, [shortsViewerRows]);
  const loadMorePosts = useCallback(async () => {
    if (loadingPostsPage.current || !hasMorePosts) return;
    loadingPostsPage.current = true;
    setLoadingMorePosts(true);
    try {
      const start = postsPage.current;
      const { data, error: pageError } = await supabase.from("posts")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .range(start, start + POSTS_PER_PAGE - 1);
      if (pageError) throw pageError;
      const page = (data ?? []) as unknown as Row[];
      postsPage.current += page.length;
      setHasMorePosts(page.length === POSTS_PER_PAGE);

      const originalIds = [...new Set(page.map((row) => row.repost_of).filter((id): id is string => !!id))];
      if (originalIds.length) {
        const { data: originals, error: originalError } = await supabase.from("posts").select(ORIG).in("id", originalIds);
        if (originalError) throw originalError;
        const originalById = new Map(((originals ?? []) as unknown as Orig[]).map((original) => [original.id, original]));
        page.forEach((row) => { row.original = row.repost_of ? originalById.get(row.repost_of) ?? null : null; });
      }

      const existingIds = new Set(rows.map((row) => row.id));
      const newRows = page.filter((row) => !existingIds.has(row.id));
      if (newRows.length) {
        setRows((current) => [...current, ...newRows]);
      }
    } catch (pageError) {
      fail(pageError);
      setHasMorePosts(false);
    } finally {
      loadingPostsPage.current = false;
      setLoadingMorePosts(false);
    }
  }, [fail, hasMorePosts, rows, supabase]);
  const markShortWatched = useCallback((id: string) => {
    if (!id) return;
    const current = watched.key === watchedKey ? watched.ids : [];
    if (current.includes(id)) return;
    const ids = [...current, id];
    try { localStorage.setItem(watchedKey, JSON.stringify(ids)); } catch { /* retain history in memory */ }
    setWatched({ key: watchedKey, ids });
  }, [watched, watchedKey]);
  const followShortAuthor = useCallback(async (row: Row) => {
    if (!me) {
      flash("Log in to follow creators.");
      return;
    }
    if (following.includes(row.user_id) || row.user_id === me) return;
    const { error: followError } = await supabase.from("follows").insert({ follower_id: me, followed_id: row.user_id });
    if (followError) {
      fail(followError);
      return;
    }
    setFollowing((current) => [...current, row.user_id]);
    const pushError = await sendActivityPush({ type: "follow", profileId: row.user_id });
    if (pushError) setError(pushError);
  }, [fail, flash, following, me, supabase]);
  const openShortComments = useCallback((row: Row) => setCommentsId(row.id), []);
  const closeCommentsSheet = useCallback(() => setCommentsId(null), []);
  const closeShorts = useCallback(() => setShorts(false), []);
  const noOp = useCallback(() => undefined, []);
  const openComposer = () => window.dispatchEvent(new Event("mv:open-composer"));
  const open = rows.find((r) => r.id === openId) ?? null;
  const commentsRow = rows.find((r) => r.id === commentsId) ?? null;
  const closePost = useCallback(() => {
    setOpenId(null);
    setOpenComments(false);
  }, []);
  const reactOpen = useCallback((kind: "vibe" | "support" | "inspire") => {
    if (open) void react(open, kind);
  }, [open, react]);
  const saveOpen = useCallback(() => { if (open) void save(open); }, [open, save]);
  const repostOpen = useCallback(() => { if (open) void repost(open); }, [open, repost]);
  const shareOpen = useCallback(() => { if (open) void share(open); }, [open, share]);
  const commentOpen = useCallback((body: string) => { if (open) void comment(open, body); }, [comment, open]);
  const reportOpen = useCallback((reason: string) => { if (open) void report(open, reason); }, [open, report]);
  const hideOpen = useCallback(() => { if (open) hide(open); }, [hide, open]);
  const toggleCommentsOpen = useCallback(() => { if (open) void toggleComments(open); }, [open, toggleComments]);
  const deleteOpen = useCallback(() => { if (open) void remove(open); }, [open, remove]);

  useEffect(() => {
    if (tab !== "Following" || loading || !hasMorePosts || !feedRows.length) return;
    const root = feedRef.current;
    const target = root?.querySelectorAll<HTMLElement>("[data-feed-post]")[Math.max(0, feedRows.length - 3)];
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMorePosts();
    }, { rootMargin: "0px 0px 700px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [feedRows.length, hasMorePosts, loadMorePosts, loading, tab]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const videos = [...root.querySelectorAll<HTMLVideoElement>("video[data-feed-video]")];
    if (shorts || openId) {
      videos.forEach((video) => {
        video.pause();
        deactivateVideo(video);
      });
      return;
    }
    const ratios = new Map<HTMLVideoElement, number>();
    const selectVisibleVideo = () => {
      const next = [...ratios.entries()]
        .filter(([, ratio]) => ratio >= 0.6)
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!next || (hasActiveVideo() && !isVideoActive(next))) return;
      activateVideo(next);
      void next.play().catch(() => undefined);
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        ratios.set(video, entry.intersectionRatio);
        if (entry.intersectionRatio < 0.6) {
          video.pause();
          deactivateVideo(video);
        }
      });
      selectVisibleVideo();
    }, { threshold: [0, 0.6, 1] });
    videos.forEach((video) => observer.observe(video));
    const onVideoReleased = () => selectVisibleVideo();
    window.addEventListener("mv:video-released", onVideoReleased);
    return () => {
      window.removeEventListener("mv:video-released", onVideoReleased);
      observer.disconnect();
      videos.forEach((video) => {
        video.pause();
        deactivateVideo(video);
      });
    };
  }, [feedRows, openId, shorts, shortsAt]);

  return (
    <section ref={feedRef} data-mode="dark" aria-label="Community feed" className="mx-auto max-w-3xl space-y-3 px-0 py-3 sm:px-3 sm:py-5">
      {tab === "Following" && me ? (
        <div className={`${card} flex items-center gap-2 p-3`}>
          <button onClick={openComposer} className="h-11 flex-1 rounded-xl bg-[#1d1840] px-4 text-left text-sm text-[#a8a2c9] hover:bg-[#25205a]">What&apos;s your vibe today?</button>
          <button onClick={openComposer} aria-label="Add photo" className="flex h-12 w-12 items-center justify-center rounded-full text-violet-500 hover:bg-white/10"><ImagePlus className="h-6 w-6" /></button>
          <button onClick={openComposer} aria-label="Add video" className="flex h-12 w-12 items-center justify-center rounded-full text-pink-500 hover:bg-white/10"><Video className="h-6 w-6" /></button>
        </div>
      ) : tab === "Following" && !loading ? (
        <Link href="/login" className={`${card} block p-4 text-center text-base text-[#c9c4e8] hover:bg-white/5`}>Log in or sign up to share your vibe</Link>
      ) : null}

      {likeToast ? <p role="status" className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-full border border-white/10 bg-[#211b3c] px-4 py-2 text-sm text-white shadow-xl">{likeToast}</p> : null}
      <div className="sticky top-14 z-20 flex items-center gap-2 rounded-b-xl border-b border-white/[0.06] bg-[#07061a] px-2 py-2">
        <div className="flex flex-1 gap-1 rounded-full bg-[#110f2e] p-1" role="tablist" aria-label="Feed sections">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-10 flex-1 rounded-full text-sm font-medium ${tab === t ? "bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-white shadow" : "text-[#c9c4e8]"}`}>{t}</button>)}
        </div>
        {tab === "Following" ? <button onClick={() => openShorts()} className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white ${BRAND}`}><Clapperboard className="h-5 w-5" aria-hidden="true" />Shorts</button> : null}
      </div>

      {tab === "For You" ? (
        <ShortsViewer
          inline
          rows={rankedShorts}
          me={me}
          onClose={noOp}
          likeOverrides={likeOverrides}
          likePopId={likePopId}
          onVibe={vibe}
          onOpen={openShortComments}
          onShare={share}
          onWatch={markShortWatched}
          onNearEnd={loadMorePosts}
          loadingMore={loadingMorePosts}
          hasMore={hasMorePosts}
          onFollow={followShortAuthor}
          onSave={save}
          followingIds={following}
        />
      ) : null}

      {note ? <p role="status" className="rounded-lg border border-violet-300/15 bg-violet-500/10 p-3 text-sm text-violet-200">{note}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-pink-400/20 bg-pink-400/10 p-3 text-sm text-pink-100">{error}</p> : null}

      <div className={tab === "Following" ? "space-y-3" : "hidden"}>
      {loading ? <p className="py-10 text-center text-[#a8a2c9]">Loading posts...</p> : feedRows.length === 0 && !error ? <p className="py-10 text-center text-[#a8a2c9]">{tab === "Following" ? "Follow people to see their posts here." : "Nothing here yet. Be the first to share your vibe."}</p> : null}

      {feedRows.map((r, index) => {
        const a = r.profiles;
        const shown = r.original ?? r;
        const m = mediaOf(shown)[0];
        const meta = typeMeta[r.type] ?? typeMeta.vibe;
        const likeOverride = likeOverrides[r.id];
        const liked = likeOverride?.liked ?? (!!me && r.vibes.some((v) => v.user_id === me));
        const vibeCount = Math.max(0, r.vibes.length + (likeOverride?.delta ?? 0));
        const saved = !!me && r.saves.some((s) => s.user_id === me);
        return (
          <div key={r.id} data-feed-post className="space-y-3 [content-visibility:auto] [contain-intrinsic-size:auto_620px]">
          <article className={card}>
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${meta.color}, #8b5cf6, #3b82f6)` }} />
            <div className="p-3 sm:p-3.5">
            <header className="mb-2 flex items-center gap-3">
                <Link href={`/${a.username}`}><Avatar p={a} size="h-12 w-12" /></Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/${a.username}`} className="block truncate text-base font-semibold hover:underline">{a.name || a.username}</Link>
                  <p className="truncate text-sm text-[#a8a2c9]">@{a.username} · {ago(r.created_at)}{r.repost_of ? " · reposted" : ""}</p>
                </div>
                <span className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: `${meta.color}22`, color: meta.color }}><meta.Icon className="h-4 w-4" aria-hidden="true" />{meta.label}</span>
              </header>

              <button onClick={() => {
                if (m?.type === "video") {
                  openShorts(r.id);
                  return;
                }
                setOpenComments(false);
                setOpenId(r.id);
              }} className="block w-full text-left" aria-label={m?.type === "video" ? "Open video" : "Open post"}>
                {shown.title ? <h3 className="mb-1 text-lg font-bold">{shown.title}</h3> : null}
                {r.body ? <p className="whitespace-pre-wrap text-base leading-relaxed">{r.body}</p> : null}
                {r.original && !r.body ? <p className="text-sm text-[#a8a2c9]">@{r.original.profiles.username}: {r.original.body.slice(0, 160)}</p> : null}
                {m ? (
                  <span className="relative mt-2.5 block overflow-hidden rounded-lg bg-black">
                    {m.type === "video" ? (
                      <>
                        <video data-feed-video src={m.url} poster={m.poster ?? m.thumbnail} preload="none" muted playsInline className="max-h-[70vh] w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/60 p-5 text-white"><Play className="h-8 w-8" /></span></span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" loading="lazy" className="max-h-[70vh] w-full object-cover" />
                    )}
                  </span>
                ) : null}
              </button>

              <footer className="-mx-2 mt-3 flex items-center">
<button onClick={() => vibe(r)} className={`${act} transition-transform duration-200 active:scale-125 ${likePopId === r.id ? "scale-125" : ""} ${liked ? "font-semibold text-pink-300" : ""}`} aria-label={r.type === "struggle" ? "Support" : "Vibe"}><Flame className={`h-6 w-6 ${liked ? "fill-current text-pink-400" : ""}`} />{vibeCount}</button>                <button onClick={() => { setOpenComments(true); setOpenId(r.id); }} className={act} aria-label="Comments"><MessageCircle className="h-6 w-6" />{r.comments.length}</button>
                <button onClick={() => void repost(r)} disabled={r.share_policy === "nobody" && r.user_id !== me} className={act} aria-label="Repost"><Repeat2 className="h-6 w-6" /></button>
                <button onClick={() => void share(r)} className={act} aria-label="Share"><Share2 className="h-6 w-6" /></button>
                <button onClick={() => void save(r)} className={`${act} ml-auto ${saved ? "text-yellow-500" : ""}`} aria-label="Save"><Bookmark className={`h-6 w-6 ${saved ? "fill-current" : ""}`} /></button>
              </footer>
            </div>
          </article>
          {(index + 1) === 4 && circleCard}
          {(index + 1) === 6 && shortsAt.get(index + 1) ? (
            <section aria-label="Shorts" className={`${card} p-3`}>
              <header className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold"><Clapperboard className="h-5 w-5 text-fuchsia-400" />Shorts</h2>
                <button onClick={() => openShorts()} className="text-sm font-semibold text-violet-300">Watch all</button>
              </header>
              <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
                {(shortsAt.get(index + 1) ?? []).map((short) => {
                  const shortMedia = mediaOf(short.original ?? short)[0];
                  return (
                    <button key={short.id} onClick={() => openShorts(short.id)} className="relative aspect-[9/14] w-28 shrink-0 snap-start overflow-hidden rounded-lg bg-black text-left sm:w-32">
                      {shortMedia.type === "video" ? <video data-feed-video src={shortMedia.url} poster={shortMedia.poster ?? shortMedia.thumbnail} muted playsInline preload="none" className="h-full w-full object-cover" /> : <img src={shortMedia.url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-8 text-xs font-semibold text-white">@{short.profiles.username}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
          {(index + 1) === 8 && marketAt.get(index + 1) ? (() => {
            const product = marketAt.get(index + 1)!;
            return (
              <a href={product.url} target="_blank" rel="noopener noreferrer" className={`${card} flex items-center gap-3 p-3 transition hover:bg-white/[0.03]`}>
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg bg-black/30 object-cover" />
                ) : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#1d1840]"><ShoppingBag className="h-6 w-6 text-violet-300" /></span>}
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-wide text-violet-300">Maestra Market</span><span className="mt-1 block truncate text-sm font-semibold text-white">{product.title}</span><span className="mt-1 block text-xs text-[#c9c4e8]">{product.currency} {product.price.toLocaleString()}</span></span>
                <ExternalLink className="h-4 w-4 shrink-0 text-[#a8a2c9]" />
              </a>
            );
          })() : null}
          {(index + 1) === 8 && !marketAt.get(index + 1) && marketError ? <p role="status" className={`${card} p-3 text-xs text-[#a8a2c9]`}>Maestra Market is unavailable: {marketError}</p> : null}
          {(index + 1) === 9 && discoverCard}
          {(index + 1) > 8 && (index + 1) % 8 === 0 && marketAt.get(index + 1) ? (() => {
            const product = marketAt.get(index + 1)!;
            return (
              <a href={product.url} target="_blank" rel="noopener noreferrer" className={`${card} flex items-center gap-3 p-3 transition hover:bg-white/[0.03]`}>
                {product.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.image_url} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-lg bg-black/30 object-cover" />
                ) : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[#1d1840]"><ShoppingBag className="h-6 w-6 text-violet-300" /></span>}
                <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-wide text-violet-300">Maestra Market</span><span className="mt-1 block truncate text-sm font-semibold text-white">{product.title}</span><span className="mt-1 block text-xs text-[#c9c4e8]">{product.currency} {product.price.toLocaleString()}</span></span>
                <ExternalLink className="h-4 w-4 shrink-0 text-[#a8a2c9]" />
              </a>
            );
          })() : null}
          {(index + 1) > 6 && (index + 1) % 6 === 0 && shortsAt.get(index + 1) ? (
            <section aria-label="Shorts" className={`${card} p-3`}>
              <header className="mb-3 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold"><Clapperboard className="h-5 w-5 text-fuchsia-400" />Shorts</h2>
                <button onClick={() => openShorts()} className="text-sm font-semibold text-violet-300">Watch all</button>
              </header>
              <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
                {shortsAt.get(index + 1)?.map((short) => {
                  const shortMedia = mediaOf(short.original ?? short)[0];
                  return <button key={short.id} onClick={() => openShorts(short.id)} className="relative aspect-[9/14] w-28 shrink-0 snap-start overflow-hidden rounded-lg bg-black text-left sm:w-32">{shortMedia.type === "video" ? <video data-feed-video src={shortMedia.url} poster={shortMedia.poster ?? shortMedia.thumbnail} muted playsInline preload="none" className="h-full w-full object-cover" /> : <img src={shortMedia.url} alt="" loading="lazy" className="h-full w-full object-cover" />}<span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-2 pt-8 text-xs font-semibold text-white">@{short.profiles.username}</span></button>;
                })}
              </div>
            </section>
          ) : null}
          </div>
        );
      })}
      </div>

      {shorts ? <ShortsViewer rows={shortsViewerRows} me={me} initialId={initialShortId} initialIndex={initialShortIndex} likeOverrides={likeOverrides} likePopId={likePopId} onClose={closeShorts} onVibe={vibe} onOpen={openShortComments} onShare={share} onWatch={markShortWatched} onNearEnd={loadMorePosts} loadingMore={loadingMorePosts} hasMore={hasMorePosts} onFollow={followShortAuthor} onSave={save} followingIds={following} /> : null}
      {open ? (
        <PostViewer
          key={open.id} row={open} me={me} initialCommentsOpen={openComments} likeOverride={likeOverrides[open.id]} likePop={likePopId === open.id} onClose={closePost}
          onReact={reactOpen} onSave={saveOpen} onRepost={repostOpen} onShare={shareOpen}
          onComment={commentOpen} onReport={reportOpen} onHide={hideOpen}
          onToggleComments={toggleCommentsOpen} onDelete={deleteOpen}
        />
      ) : null}
      {commentsRow ? (
        <CommentsSheet key={commentsRow.id} row={commentsRow} me={me} onClose={closeCommentsSheet} onComment={(body) => void comment(commentsRow, body)} />
      ) : null}
    </section>
  );
}


