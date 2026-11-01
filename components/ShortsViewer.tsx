// path: maestra-vibe/components/ShortsViewer.tsx  (NEW file)
// TikTok jaisa full-screen vertical video feed: upar neeche swipe, khud play/pause.
"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, HandHeart, MessageCircle, Share2, Volume2, VolumeX, X } from "lucide-react";
import { useOverlayHistory } from "@/lib/useOverlayHistory";
import { Avatar, mediaOf, type Row } from "@/components/postUtils";

const rail = "flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-full bg-black/40 px-2 text-xs text-white backdrop-blur active:scale-95";

export default function ShortsViewer({ rows, me, initialId, onClose, onVibe, onOpen, onShare, onWatch }: {
  rows: Row[]; me: string | null; initialId?: string | null; onClose: () => void; onVibe: (r: Row) => void; onOpen: (r: Row) => void; onShare: (r: Row) => void; onWatch: (id: string) => void;
}) {
  useOverlayHistory(onClose);
  const [muted, setMuted] = useState(true);
  const videos = useRef<Record<string, HTMLVideoElement | null>>({});
  const container = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedUntil = useRef(0);
  const onWatchRef = useRef(onWatch);
  const [activeIndex, setActiveIndex] = useState(() => Math.max(0, rows.findIndex((row) => row.id === initialId)));
  onWatchRef.current = onWatch;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const ratios = new Map<HTMLVideoElement, number>();
    const containerElement = container.current;
    const blockLockedInput = (event: WheelEvent | TouchEvent) => {
      if (Date.now() < lockedUntil.current) event.preventDefault();
    };
    containerElement?.addEventListener("wheel", blockLockedInput, { passive: false });
    containerElement?.addEventListener("touchmove", blockLockedInput, { passive: false });
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => ratios.set(entry.target as HTMLVideoElement, entry.intersectionRatio));
        const active = [...ratios.entries()]
          .filter(([, ratio]) => ratio >= 0.6)
          .sort((a, b) => b[1] - a[1])[0]?.[0];
        Object.values(videos.current).forEach((video) => {
          if (!video) return;
          if (video === active) {
            void video.play().catch(() => undefined);
            onWatchRef.current(video.dataset.postId ?? "");
          } else {
            video.pause();
          }
        });
      },
      { threshold: [0, 0.6, 1] }
    );
    Object.values(videos.current).forEach((v) => v && io.observe(v));
    if (initialId) {
      const index = rows.findIndex((row) => row.id === initialId);
      if (index >= 0) container.current?.scrollTo({ top: index * container.current.clientHeight, behavior: "auto" });
    }
    return () => {
      io.disconnect();
      containerElement?.removeEventListener("wheel", blockLockedInput);
      containerElement?.removeEventListener("touchmove", blockLockedInput);
      if (settleTimer.current) clearTimeout(settleTimer.current);
      Object.values(videos.current).forEach((video) => video?.pause());
      document.body.style.overflow = prev;
    };
  }, [rows, initialId]);

  const handleScroll = () => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      lockedUntil.current = Date.now() + 600;
    }, 120);
    const el = container.current;
    if (el) setActiveIndex(Math.round(el.scrollTop / el.clientHeight));
  };

  return (
    <div className="fixed inset-0 z-[55] bg-black" role="dialog" aria-modal="true" aria-label="Shorts">
      <button onClick={onClose} aria-label="Close shorts" className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"><X className="h-6 w-6" /></button>
      <button onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white">{muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}</button>

      {rows.length === 0 ? <p className="flex h-full items-center justify-center text-white/70">No videos yet. Post the first one!</p> : (
        <div ref={container} onScroll={handleScroll} className="h-dvh snap-y snap-mandatory overflow-y-scroll overscroll-contain">
          {rows.map((r, index) => {
            const shown = r.original ?? r;
            const m = mediaOf(shown)[0];
            const liked = !!me && r.vibes.some((v) => v.user_id === me);
            return (
              <section key={r.id} style={{ scrollSnapStop: "always" }} className="relative h-dvh w-full snap-start bg-black">
                <video ref={(el) => { videos.current[r.id] = el; }} data-post-id={shown.id} src={m?.url} loop muted={muted} playsInline preload={index === activeIndex || index === activeIndex + 1 ? "auto" : "none"} className="h-full w-full object-contain" onClick={(e) => { const v = e.currentTarget; if (v.paused) void v.play(); else v.pause(); }} />
                <div className="absolute bottom-20 right-3 flex flex-col items-center gap-3 md:bottom-8">
                  <button onClick={() => onVibe(r)} aria-label={r.type === "struggle" ? "Support" : "Vibe"} className={`${rail} ${liked ? "text-orange-400" : ""}`}>{r.type === "struggle" ? <HandHeart className="h-6 w-6" /> : <Flame className="h-6 w-6" />}{r.vibes.length}</button>
                  <button onClick={() => onOpen(r)} aria-label="Comments" className={rail}><MessageCircle className="h-6 w-6" />{r.comments.length}</button>
                  <button onClick={() => onShare(r)} aria-label="Share" className={rail}><Share2 className="h-6 w-6" /></button>
                </div>
                <div className="absolute bottom-20 left-3 right-20 text-white md:bottom-8">
                  <div className="mb-2 flex items-center gap-2"><Avatar p={r.profiles} size="h-9 w-9" /><span className="truncate font-semibold">@{r.profiles.username}</span></div>
                  {shown.title ? <p className="font-bold">{shown.title}</p> : null}
                  {r.body ? <p className="line-clamp-2 text-sm text-white/90">{r.body}</p> : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}