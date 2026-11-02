"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flame, HandHeart, MessageCircle, Share2, Volume2, VolumeX, X } from "lucide-react";
import { useOverlayHistory } from "@/lib/useOverlayHistory";
import { activateVideo, deactivateVideo } from "@/lib/activeVideo";
import { Avatar, mediaOf, type Row } from "@/components/postUtils";

const rail = "flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-full bg-black/40 px-2 text-xs text-white backdrop-blur active:scale-95";

export default function ShortsViewer({ rows, me, initialId, onClose, onVibe, onOpen, onShare, onWatch }: {
  rows: Row[];
  me: string | null;
  initialId?: string | null;
  onClose: () => void;
  onVibe: (row: Row) => void;
  onOpen: (row: Row) => void;
  onShare: (row: Row) => void;
  onWatch: (id: string) => void;
}) {
  useOverlayHistory(onClose);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, rows.findIndex((row) => row.id === initialId)));
  const [pausedId, setPausedId] = useState<string | null>(null);
  const videos = useRef<Record<string, HTMLVideoElement | null>>({});
  const container = useRef<HTMLDivElement>(null);
  const startTouch = useRef<{ x: number; y: number } | null>(null);
  const lockedUntil = useRef(0);
  const activeIndexRef = useRef(activeIndex);
  const watchedRef = useRef(onWatch);
  const manuallyPaused = useRef(new Set<string>());

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    watchedRef.current = onWatch;
  }, [onWatch]);

  const goTo = useCallback((index: number) => {
    const element = container.current;
    if (!element || Date.now() < lockedUntil.current) return;
    const target = Math.max(0, Math.min(rows.length - 1, index));
    if (target === activeIndexRef.current) return;
    lockedUntil.current = Date.now() + 600;
    activeIndexRef.current = target;
    setActiveIndex(target);
    element.scrollTo({ top: target * element.clientHeight, behavior: "smooth" });
  }, [rows.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowDown") goTo(activeIndexRef.current + 1);
      if (event.key === "ArrowUp") goTo(activeIndexRef.current - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goTo, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const ratios = new Map<HTMLVideoElement, number>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const video = entry.target as HTMLVideoElement;
        ratios.set(video, entry.intersectionRatio);
        if (entry.intersectionRatio < 0.6) {
          manuallyPaused.current.delete(video.dataset.postId ?? "");
          video.pause();
          deactivateVideo(video);
          setPausedId((current) => current === video.dataset.postId ? null : current);
        }
      });
      const visible = [...ratios.entries()]
        .filter(([video, ratio]) => ratio >= 0.6 && !manuallyPaused.current.has(video.dataset.postId ?? ""))
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      if (visible) {
        activateVideo(visible);
        void visible.play().catch(() => undefined);
        setPausedId(null);
        watchedRef.current(visible.dataset.postId ?? "");
      }
    }, { threshold: [0, 0.6, 1] });
    const videoElements = Object.values(videos.current).filter((video): video is HTMLVideoElement => !!video);
    videoElements.forEach((video) => observer.observe(video));

    const element = container.current;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      if (Math.abs(event.deltaY) < 10) return;
      goTo(activeIndexRef.current + (event.deltaY > 0 ? 1 : -1));
    };
    element?.addEventListener("wheel", onWheel, { passive: false });
    const initialIndex = rows.findIndex((row) => row.id === initialId);
    if (initialIndex >= 0 && element) {
      activeIndexRef.current = initialIndex;
      element.scrollTo({ top: initialIndex * element.clientHeight, behavior: "auto" });
    }

    return () => {
      observer.disconnect();
      element?.removeEventListener("wheel", onWheel);
      videoElements.forEach((video) => {
        video.pause();
        deactivateVideo(video);
      });
      document.body.style.overflow = previousOverflow;
    };
  }, [goTo, initialId, rows]);

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

  const togglePlayback = (rowId: string) => {
    const video = videos.current[rowId];
    if (!video) return;
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
    <div className="fixed inset-0 z-[55] bg-black" role="dialog" aria-modal="true" aria-label="Shorts">
      <button onClick={onClose} aria-label="Close shorts" className="absolute left-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"><X className="h-6 w-6" /></button>
      <button onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute" : "Mute"} className="absolute right-3 top-3 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white">{muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}</button>

      {rows.length === 0 ? <p className="flex h-full items-center justify-center text-white/70">No videos yet. Post the first one!</p> : (
        <div
          ref={container}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="h-dvh snap-y snap-mandatory overflow-y-scroll overscroll-contain touch-none"
        >
          {rows.map((row) => {
            const shown = row.original ?? row;
            const media = mediaOf(shown)[0];
            const liked = !!me && row.vibes.some((vibe) => vibe.user_id === me);
            return (
              <section key={row.id} style={{ scrollSnapStop: "always" }} className="relative h-dvh w-full snap-start bg-black">
                <video
                  ref={(element) => { videos.current[row.id] = element; }}
                  data-post-id={shown.id}
                  src={media?.url}
                  poster={media?.poster ?? media?.thumbnail}
                  loop
                  muted={muted}
                  playsInline
                  preload={Math.abs(rows.findIndex((item) => item.id === row.id) - activeIndex) <= 1 ? "auto" : "none"}
                  onPlay={(event) => activateVideo(event.currentTarget)}
                  onClick={() => togglePlayback(row.id)}
                  className="h-full w-full object-contain"
                />
                {pausedId === row.id ? <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/55 p-5 text-3xl text-white">▶</span></div> : null}
                <div className="absolute bottom-20 right-3 z-[1] flex flex-col items-center gap-3 md:bottom-8">
                  <button onClick={() => onVibe(row)} aria-label={row.type === "struggle" ? "Support" : "Vibe"} className={`${rail} ${liked ? "text-pink-300" : ""}`}>{row.type === "struggle" ? <HandHeart className="h-6 w-6" /> : <Flame className="h-6 w-6" />}{row.vibes.length}</button>
                  <button onClick={() => onOpen(row)} aria-label="Open comments" className={rail}><MessageCircle className="h-6 w-6" />{row.comments.length}</button>
                  <button onClick={() => onShare(row)} aria-label="Share" className={rail}><Share2 className="h-6 w-6" /></button>
                </div>
                <div className="absolute bottom-20 left-3 right-20 z-[1] text-white md:bottom-8">
                  <div className="mb-2 flex items-center gap-2"><Avatar p={row.profiles} size="h-9 w-9" /><span className="truncate font-semibold">@{row.profiles.username}</span></div>
                  {shown.title ? <p className="font-bold">{shown.title}</p> : null}
                  {row.body ? <p className="line-clamp-2 text-sm text-white/90">{row.body}</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
