"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Flame, HandHeart, MessageCircle, Share2, Volume2, VolumeX, X } from "lucide-react";
import { useOverlayHistory } from "@/lib/useOverlayHistory";
import { activateVideo, deactivateVideo } from "@/lib/activeVideo";
import { Avatar, mediaOf, type Row } from "@/components/postUtils";

const rail = "flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-full bg-black/40 px-2 text-xs text-white backdrop-blur active:scale-95";

export default function ShortsViewer({ rows, me, initialId, initialIndex, onClose, onVibe, onOpen, onShare, onWatch, onNearEnd, loadingMore, hasMore, inline = false, onFollow, onSave }: {
  rows: Row[];
  me: string | null;
  initialId?: string | null;
  initialIndex?: number;
  onClose: () => void;
  onVibe: (row: Row) => void;
  onOpen: (row: Row) => void;
  onShare: (row: Row) => void;
  onWatch: (id: string) => void;
  onNearEnd?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  inline?: boolean;
  onFollow?: (row: Row) => void;
  onSave?: (row: Row) => void;
}) {
  useOverlayHistory(onClose, !inline);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, initialIndex ?? rows.findIndex((row) => row.id === initialId)));
  const [pausedId, setPausedId] = useState<string | null>(null);
  const playableRows = useMemo(() => {
    if (!rows.length) return [];
    const minimumLength = Math.max(5, rows.length);
    return Array.from({ length: minimumLength }, (_, index) => ({
      row: rows[index % rows.length],
      slot: index,
    }));
  }, [rows]);
  const videos = useRef<Record<number, HTMLVideoElement | null>>({});
  const container = useRef<HTMLDivElement>(null);
  const startTouch = useRef<{ x: number; y: number } | null>(null);
  const activeIndexRef = useRef(activeIndex);
  const watchedRef = useRef(onWatch);
  const nearEndRef = useRef(onNearEnd);
  const manuallyPaused = useRef(new Set<string>());
  const wheelLocked = useRef(false);
  const wheelTimer = useRef<number | null>(null);
  const initialIdApplied = useRef(false);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    watchedRef.current = onWatch;
  }, [onWatch]);

  useEffect(() => {
    nearEndRef.current = onNearEnd;
  }, [onNearEnd]);

  const goTo = useCallback((index: number) => {
    const element = container.current;
    if (!element || !playableRows.length) return;
    const target = (index + playableRows.length) % playableRows.length;
    if (target === activeIndexRef.current) return;
    activeIndexRef.current = target;
    setActiveIndex(target);
    element.scrollTo({ top: target * element.clientHeight, behavior: "smooth" });
  }, [playableRows.length]);

  useEffect(() => {
    if (inline) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") goTo(activeIndexRef.current + 1);
      if (event.key === "ArrowUp") goTo(activeIndexRef.current - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, inline, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (!inline) document.body.style.overflow = "hidden";
    const element = container.current;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (Math.abs(event.deltaY) < 10 || wheelLocked.current) return;
      wheelLocked.current = true;
      goTo(activeIndexRef.current + (event.deltaY > 0 ? 1 : -1));
      if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
      wheelTimer.current = window.setTimeout(() => {
        wheelLocked.current = false;
        wheelTimer.current = null;
      }, 180);
    };
    element?.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      element?.removeEventListener("wheel", onWheel);
      Object.values(videos.current).forEach((video) => {
        if (!video) return;
        video.pause();
        deactivateVideo(video);
      });
      if (wheelTimer.current !== null) window.clearTimeout(wheelTimer.current);
      if (!inline) document.body.style.overflow = previousOverflow;
    };
  }, [goTo, inline]);

  useEffect(() => {
    if (!playableRows.length) {
      if (hasMore && !loadingMore) nearEndRef.current?.();
      return;
    }

    const requestedIndex = !initialIdApplied.current
      ? initialIndex ?? (initialId ? playableRows.findIndex(({ row }) => row.id === initialId) : -1)
      : -1;
    const nextIndex = requestedIndex >= 0 ? requestedIndex : Math.min(activeIndexRef.current, playableRows.length - 1);
    initialIdApplied.current = true;
    activeIndexRef.current = nextIndex;
    setActiveIndex(nextIndex);
    const element = container.current;
    if (element) element.scrollTo({ top: nextIndex * element.clientHeight, behavior: "auto" });
  }, [hasMore, initialId, initialIndex, loadingMore, playableRows]);

  useEffect(() => {
    const activeVideo = videos.current[activeIndex];
    Object.entries(videos.current).forEach(([slot, video]) => {
      if (!video) return;
      if (Number(slot) !== activeIndex) {
        video.pause();
        deactivateVideo(video);
      }
    });
    if (!activeVideo || manuallyPaused.current.has(activeVideo.dataset.postId ?? "")) return;
    activateVideo(activeVideo);
    void activeVideo.play().catch(() => undefined);
    setPausedId(null);
    watchedRef.current(activeVideo.dataset.postId ?? "");
  }, [activeIndex, playableRows]);

  useEffect(() => {
    if (activeIndex >= Math.max(0, rows.length - 3) && hasMore && !loadingMore) nearEndRef.current?.();
  }, [activeIndex, hasMore, loadingMore, playableRows.length, rows.length]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => element.scrollTo({ top: activeIndexRef.current * element.clientHeight, behavior: "auto" });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    startTouch.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (startTouch.current) event.preventDefault();
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    const start = startTouch.current;
    const touch = event.changedTouches[0];
    startTouch.current = null;
    if (!start || !touch) return;
    const deltaY = start.y - touch.clientY;
    const deltaX = start.x - touch.clientX;
    if (Math.abs(deltaX) > 100 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      onClose();
      return;
    }
    if (Math.abs(deltaY) >= 40) goTo(activeIndexRef.current + (deltaY > 0 ? 1 : -1));
  };

  const togglePlayback = () => {
    const video = videos.current[activeIndexRef.current];
    if (!video) return;
    const rowId = video.dataset.postId ?? "";
    if (video.paused) {
      manuallyPaused.current.delete(rowId);
      activateVideo(video);
      void video.play().catch(() => undefined);
      setPausedId(null);
    } else {
      manuallyPaused.current.add(rowId);
      video.pause();
      setPausedId(rowId);
      window.setTimeout(() => setPausedId((current) => current === rowId ? null : current), 700);
    }
  };

  return (
    <div className={inline ? "relative h-[calc(100dvh-13rem)] min-h-[400px] overflow-hidden rounded-2xl bg-black sm:h-[min(78dvh,900px)]" : "fixed inset-0 z-[55] bg-black"} role="dialog" aria-modal={!inline || undefined} aria-label="Shorts">
      {!inline ? <button onClick={onClose} aria-label="Close shorts" className="absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"><X className="h-6 w-6" /></button> : null}
      <button onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute" : "Mute"} className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white">{muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}</button>

      {rows.length === 0 ? (
        <p className="flex h-full items-center justify-center text-white/70">
          {loadingMore || hasMore ? "Loading videos…" : "No videos yet. Post the first one!"}
        </p>
      ) : (
        <div
          ref={container}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className={`h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain touch-none ${inline ? "" : "h-dvh"}`}
        >
          {playableRows.map(({ row, slot }) => {
            const shown = row.original ?? row;
            const media = mediaOf(shown)[0];
            const liked = !!me && row.vibes.some((vibe) => vibe.user_id === me);
            return (
              <section key={`${row.id}:${slot}`} style={{ scrollSnapStop: "always" }} className="relative h-full min-h-0 w-full snap-start bg-black">
                {media?.type === "video" ? (
                  <video
                    ref={(element) => { videos.current[slot] = element; }}
                    data-post-id={shown.id}
                    src={media.url}
                    poster={media.poster ?? media.thumbnail}
                    muted={muted}
                    playsInline
                    preload={Math.abs(slot - activeIndex) <= 1 ? "auto" : "none"}
                    onPlay={(event) => {
                      if (slot !== activeIndexRef.current) {
                        event.currentTarget.pause();
                        return;
                      }
                      activateVideo(event.currentTarget);
                    }}
                    onEnded={() => {
                      watchedRef.current(shown.id);
                      goTo(activeIndexRef.current + 1);
                    }}
                    onClick={togglePlayback}
                    className="h-full w-full object-contain"
                  />
                ) : media ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.url} alt={shown.title || row.body || "Post"} className="h-full w-full object-contain" />
                ) : null}
                {pausedId === row.id ? <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/55 p-5 text-3xl text-white">▶</span></div> : null}
                <div className="absolute bottom-20 right-3 z-[1] flex flex-col items-center gap-3 md:bottom-8">
                  <button type="button" onClick={() => onFollow?.(row)} aria-label={`Follow @${row.profiles.username}`} className="relative mb-1 flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-black/35">
                    <Avatar p={row.profiles} size="h-11 w-11" />
                    {onFollow ? <span className="absolute -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-xs font-bold text-white">+</span> : null}
                  </button>
                  <button onClick={() => onVibe(row)} aria-label={row.type === "struggle" ? "Support" : "Vibe"} className={`${rail} ${liked ? "text-pink-300" : ""}`}>{row.type === "struggle" ? <HandHeart className="h-6 w-6" /> : <Flame className="h-6 w-6" />}{row.vibes.length}</button>
                  <button onClick={() => onOpen(row)} aria-label="Open comments" className={rail}><MessageCircle className="h-6 w-6" />{row.comments.length}</button>
                  {onSave ? <button onClick={() => onSave(row)} aria-label="Save post" className={rail}><span className="text-xl">▣</span>Save</button> : null}
                  <button onClick={() => onShare(row)} aria-label="Share" className={rail}><Share2 className="h-6 w-6" /></button>
                </div>
                <div className="absolute bottom-20 left-3 right-20 z-[1] text-white md:bottom-8">
                  <div className="mb-2 flex items-center gap-2"><span className="truncate font-semibold">@{row.profiles.username}</span>{onFollow ? <button onClick={() => onFollow(row)} className="rounded-full border border-white/70 px-3 py-1 text-xs font-semibold">Follow</button> : null}</div>
                  {shown.title ? <p className="font-bold">{shown.title}</p> : null}
                  {row.body ? <p className="line-clamp-2 text-sm text-white/90">{row.body}</p> : null}
                  {row.tags?.length ? <p className="mt-1 line-clamp-1 text-xs text-white/85">{row.tags.map((tag) => `#${tag}`).join(" ")}</p> : null}
                  <p className="mt-1 text-xs text-white/70">♫ Original sound · MaestraVibe</p>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
