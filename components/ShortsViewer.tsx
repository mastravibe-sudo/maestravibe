// path: maestra-vibe/components/ShortsViewer.tsx  (NEW file)
// TikTok jaisa full-screen vertical video feed: upar neeche swipe, khud play/pause.
"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, HandHeart, MessageCircle, Share2, Volume2, VolumeX, X } from "lucide-react";
import { useOverlayHistory } from "@/lib/useOverlayHistory";
import { Avatar, mediaOf, type Row } from "@/components/PostViewer";

const rail = "flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-full bg-black/40 px-2 text-xs text-white backdrop-blur active:scale-95";

export default function ShortsViewer({ rows, me, onClose, onVibe, onOpen, onShare }: {
  rows: Row[]; me: string | null; onClose: () => void; onVibe: (r: Row) => void; onOpen: (r: Row) => void; onShare: (r: Row) => void;
}) {
  useOverlayHistory(onClose);
  const [muted, setMuted] = useState(true);
  const videos = useRef<Record<string, HTMLVideoElement | null>>({});

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        const v = e.target as HTMLVideoElement;
        if (e.isIntersecting && e.intersectionRatio >= 0.6) void v.play().catch(() => undefined);
        else v.pause();
      }),
      { threshold: [0, 0.6, 1] }
    );
    Object.values(videos.current).forEach((v) => v && io.observe(v));
    return () => { io.disconnect(); document.body.style.overflow = prev; };
  }, [rows]);

  return (
    <div className="fixed inset-0 z-[55] bg-black" role="dialog" aria-modal="true" aria-label="Shorts">
      <button onClick={onClose} aria-label="Close shorts" className="absolute left-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white"><X className="h-6 w-6" /></button>
      <button onClick={() => setMuted(!muted)} aria-label={muted ? "Unmute" : "Mute"} className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-white">{muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}</button>

      {rows.length === 0 ? <p className="flex h-full items-center justify-center text-white/70">No videos yet. Post the first one!</p> : (
        <div className="h-dvh snap-y snap-mandatory overflow-y-scroll">
          {rows.map((r) => {
            const shown = r.original ?? r;
            const m = mediaOf(shown)[0];
            const liked = !!me && r.vibes.some((v) => v.user_id === me);
            return (
              <section key={r.id} className="relative h-dvh w-full snap-start bg-black">
                <video ref={(el) => { videos.current[r.id] = el; }} src={m?.url} loop muted={muted} playsInline preload="metadata" className="h-full w-full object-contain" onClick={(e) => { const v = e.currentTarget; if (v.paused) void v.play(); else v.pause(); }} />
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