"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bookmark, Ellipsis, EyeOff, Flag, Flame, HandHeart, Link2, LockKeyhole, MapPin, MessageCircle, Repeat2, Send, Share2, Smile, Sticker, Trash2, Volume2, VolumeX, X } from "lucide-react";
import { EMOJIS, STICKERS, stickerOf, stickerToken } from "@/lib/stickers";
import { typeMeta } from "@/components/postMeta";
import { useOverlayHistory } from "@/lib/useOverlayHistory";
import { Avatar, ago, mediaOf, type Row } from "@/components/postUtils";
import { activateVideo, deactivateVideo } from "@/lib/activeVideo";

export { Avatar, ago, mediaOf } from "@/components/postUtils";
export type { CommentRow, Media, Orig, Person, Row } from "@/components/postUtils";

type Props = {
  row: Row;
  me: string | null;
  initialCommentsOpen?: boolean;
  onClose: () => void;
  onReact: (kind: "vibe" | "support" | "inspire") => void;
  onSave: () => void;
  onRepost: () => void;
  onShare: () => void;
  onComment: (body: string) => void;
  onReport: (reason: string) => void;
  onHide: () => void;
  onToggleComments: () => void;
  onDelete: () => void;
};

const rail = "flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-full bg-black/40 px-2 text-xs text-white backdrop-blur active:scale-95";
const menuItem = "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10";

export default function PostViewer({
  row, me, initialCommentsOpen = false, onClose, onReact, onSave, onRepost, onShare, onComment, onReport, onHide, onToggleComments, onDelete,
}: Props) {
  useOverlayHistory(onClose);
  const [draft, setDraft] = useState("");
  const [tray, setTray] = useState<"emoji" | "sticker" | null>(null);
  const [menu, setMenu] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [showPlaybackIcon, setShowPlaybackIcon] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commentsOpenRef = useRef(commentsOpen);
  const onCloseRef = useRef(onClose);
  const shown = row.original ?? row;
  const media = mediaOf(shown);
  const author = row.profiles;
  const mine = me === row.user_id;
  const saved = !!me && row.saves.some((entry) => entry.user_id === me);
  const closed = row.comments_closed || row.comment_policy === "off";
  const TypeIcon = (typeMeta[row.type] ?? typeMeta.vibe).Icon;
  const comments = [...row.comments].sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.created_at.localeCompare(b.created_at));
  const liked = !!me && row.vibes.some((vibe) => vibe.user_id === me);
  useOverlayHistory(() => setCommentsOpen(false), commentsOpen);

  useEffect(() => {
    commentsOpenRef.current = commentsOpen;
    onCloseRef.current = onClose;
  }, [commentsOpen, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (commentsOpenRef.current) setCommentsOpen(false);
      else onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      activateVideo(video);
      void video.play().catch(() => undefined);
    }
    return () => {
      if (video) {
        video.pause();
        deactivateVideo(video);
      }
      if (playbackTimer.current) clearTimeout(playbackTimer.current);
    };
  }, []);

  const send = () => {
    if (!draft.trim() || closed) return;
    onComment(draft.trim());
    setDraft("");
    setTray(null);
  };
  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      activateVideo(video);
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    setShowPlaybackIcon(true);
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
    playbackTimer.current = setTimeout(() => setShowPlaybackIcon(false), 700);
  };
  return (
    <div className="fixed inset-0 z-[60] isolate overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="Post viewer">
      {media[0]?.type === "video" ? (
        <video
          ref={videoRef}
          src={media[0].url}
          poster={media[0].poster ?? media[0].thumbnail}
          autoPlay
          loop
          muted={muted}
          playsInline
          onPlay={(event) => { activateVideo(event.currentTarget); setPlaying(true); }}
          onPause={() => setPlaying(false)}
          onClick={togglePlayback}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : media[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media[0].url} alt="" className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-8 text-center">
          <p className="max-w-2xl whitespace-pre-wrap text-2xl font-semibold">{shown.body}</p>
        </div>
      )}

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />
      <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <button onClick={onClose} aria-label="Close post" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/45 backdrop-blur"><X className="h-5 w-5" /></button>
        <Link href={`/${author.username}`} className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar p={author} size="h-10 w-10" />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{author.name || author.username}</span><span className="block truncate text-xs text-white/65">@{author.username} · {ago(row.created_at)}</span></span>
        </Link>
        {media[0]?.type === "video" ? <button onClick={() => setMuted((value) => !value)} aria-label={muted ? "Unmute video" : "Mute video"} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 backdrop-blur">{muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}</button> : null}
        <div className="relative">
          <button onClick={() => setMenu((value) => !value)} aria-label="More post options" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 backdrop-blur"><Ellipsis className="h-5 w-5" /></button>
          {menu ? (
            <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-white/10 bg-[#171426] p-1 shadow-xl">
              <button className={menuItem} onClick={() => { onShare(); setMenu(false); }}><Link2 className="h-4 w-4" />Copy link</button>
              {mine ? (
                <>
                  <button className={menuItem} onClick={() => { onToggleComments(); setMenu(false); }}><LockKeyhole className="h-4 w-4" />{closed ? "Turn comments on" : "Turn comments off"}</button>
                  <button className={`${menuItem} text-red-300`} onClick={() => { if (confirm("Delete this post?")) onDelete(); }}><Trash2 className="h-4 w-4" />Delete post</button>
                </>
              ) : (
                <>
                  <button className={menuItem} onClick={() => { onHide(); onClose(); }}><EyeOff className="h-4 w-4" />Not interested</button>
                  <button className={menuItem} onClick={() => { const reason = prompt("Why are you reporting this post? (spam, harassment, fake, other)"); if (reason) { onReport(reason); onClose(); } setMenu(false); }}><Flag className="h-4 w-4" />Report</button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {media[0]?.type === "video" && showPlaybackIcon ? (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <span className="rounded-full bg-black/55 p-5 text-white/95 backdrop-blur">{playing ? <span className="block h-8 w-8 text-2xl leading-8">Ⅱ</span> : <span className="block h-8 w-8 text-center text-2xl leading-8">▶</span>}</span>
        </div>
      ) : null}

      <div className="absolute bottom-0 left-0 right-0 z-10 flex items-end justify-between gap-3 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-16 sm:px-6 sm:pb-6">
        <div className="min-w-0 flex-1">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-violet-200"><TypeIcon className="h-3.5 w-3.5" />{(typeMeta[row.type] ?? typeMeta.vibe).label}</p>
          {shown.title ? <h1 className="mb-1 text-lg font-bold">{shown.title}</h1> : null}
          {row.body && row.body !== shown.body ? <p className="mb-1 whitespace-pre-wrap text-sm leading-relaxed">{row.body}</p> : null}
          {shown.body ? <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-white/90">{shown.body}</p> : null}
          {row.tags?.length ? <p className="mt-2 flex flex-wrap gap-2 text-xs text-violet-200">{row.tags.map((tag) => <span key={tag}>#{tag}</span>)}</p> : null}
          {row.location ? <p className="mt-2 flex items-center gap-1 text-xs text-white/70"><MapPin className="h-3.5 w-3.5" />{row.location}</p> : null}
          {row.original ? <p className="mt-2 text-xs text-white/65"><Repeat2 className="mr-1 inline h-3.5 w-3.5" />Reposted from @{row.original.profiles.username}</p> : null}
        </div>
        <div className="flex shrink-0 flex-col items-center gap-3">
          <button onClick={() => onReact(row.type === "struggle" ? "support" : "vibe")} aria-label={row.type === "struggle" ? "Support" : "Vibe"} className={`${rail} ${liked ? "text-pink-300" : ""}`}>{row.type === "struggle" ? <HandHeart className="h-6 w-6" /> : <Flame className="h-6 w-6" />}{row.vibes.length}</button>
          <button onClick={() => setCommentsOpen(true)} aria-label="Open comments" className={rail}><MessageCircle className="h-6 w-6" />{comments.length}</button>
          <button onClick={onRepost} disabled={row.share_policy === "nobody" && !mine} aria-label="Repost" className={rail}><Repeat2 className="h-6 w-6" /></button>
          <button onClick={onShare} aria-label="Share" className={rail}><Share2 className="h-6 w-6" /></button>
          <button onClick={onSave} aria-label="Save post" className={`${rail} ${saved ? "text-yellow-300" : ""}`}><Bookmark className={`h-6 w-6 ${saved ? "fill-current" : ""}`} /></button>
        </div>
      </div>

      {commentsOpen ? (
        <div className="absolute inset-0 z-20 flex items-end bg-black/45" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommentsOpen(false); }}>
          <section aria-label="Comments" className="flex max-h-[78dvh] w-full flex-col rounded-t-3xl border border-white/10 bg-[#141028] pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
            <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
              <h2 className="text-sm font-semibold">Comments <span className="text-white/55">{comments.length}</span></h2>
              <button onClick={() => setCommentsOpen(false)} aria-label="Close comments" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><X className="h-5 w-5" /></button>
            </header>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {comments.length === 0 ? <p className="py-8 text-center text-sm text-[#a8a2c9]">No comments yet.</p> : comments.map((comment) => {
                const sticker = stickerOf(comment.body);
                return (
                  <div key={comment.id} className="flex gap-2">
                    <Link href={`/${comment.profiles.username}`}><Avatar p={comment.profiles} size="h-8 w-8" /></Link>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">{comment.profiles.name || comment.profiles.username} <span className="font-normal text-[#a8a2c9]">{ago(comment.created_at)}</span></p>
                      {sticker ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sticker.src} alt={sticker.label} className="mt-1 h-16 w-16" />
                      ) : <p className="whitespace-pre-wrap break-words text-sm text-[#d8d3f5]">{comment.body}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
            {closed ? <p className="border-t border-white/10 p-4 text-sm text-[#a8a2c9]">Comments are turned off for this post.</p> : me ? (
              <footer className="shrink-0 border-t border-white/10 p-3">
                {tray === "emoji" ? <div className="mb-2 grid max-h-28 grid-cols-8 gap-1 overflow-y-auto rounded-lg bg-[#1d1840] p-2 text-xl">{EMOJIS.map((emoji) => <button key={emoji} onClick={() => setDraft((current) => current + emoji)} className="rounded hover:bg-white/10">{emoji}</button>)}</div> : null}
                {tray === "sticker" ? (
                  <div className="mb-2 grid grid-cols-4 gap-2 rounded-lg bg-[#1d1840] p-2">
                    {STICKERS.map((sticker) => (
                      <button key={sticker.id} onClick={() => { onComment(stickerToken(sticker.id)); setTray(null); }} className="rounded p-1 hover:bg-white/10" aria-label={sticker.label}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sticker.src} alt="" className="h-12 w-12" />
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex items-center gap-1">
                  <button onClick={() => setTray((current) => current === "emoji" ? null : "emoji")} aria-label="Emoji" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><Smile className="h-5 w-5" /></button>
                  <button onClick={() => setTray((current) => current === "sticker" ? null : "sticker")} aria-label="Stickers" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><Sticker className="h-5 w-5" /></button>
                  <input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} placeholder="Add a comment..." className="min-w-0 flex-1 rounded-full bg-[#1d1840] px-4 py-2.5 text-sm outline-none placeholder:text-[#a8a2c9]" />
                  <button onClick={send} aria-label="Send comment" className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-fuchsia-500 to-blue-500"><Send className="h-4 w-4" /></button>
                </div>
              </footer>
            ) : <Link href="/login" className="m-3 block rounded-lg bg-gradient-to-r from-violet-600 via-fuchsia-500 to-blue-500 py-3 text-center text-sm font-semibold text-white">Log in to comment</Link>}
          </section>
        </div>
      ) : null}
    </div>
  );
}
