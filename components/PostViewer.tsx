"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Ellipsis, EyeOff, Flag, Flame, Link2, LockKeyhole, MapPin, MessageCircle, Repeat2, Share2, Trash2, X } from "lucide-react";
import CommentsSheet from "@/components/CommentsSheet";
import { useOverlayHistory } from "@/lib/useOverlayHistory";
import { typeMeta } from "@/components/postMeta";
import { Avatar, ago, mediaOf, type Row } from "@/components/postUtils";
import { activateVideo, deactivateVideo } from "@/lib/activeVideo";

export { Avatar, ago, mediaOf } from "@/components/postUtils";
export type { CommentRow, Media, Orig, Person, Row } from "@/components/postUtils";

type Props = {
  row: Row;
  me: string | null;
  initialCommentsOpen?: boolean;
  likeOverride?: { liked: boolean; delta: number; kind: string };
  likePop?: boolean;
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

const rail = "flex min-h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-full bg-black/40 px-2 text-xs text-white active:scale-95";
const menuItem = "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10";
const subscribeNoop = () => () => undefined;

function PostViewer({
  row, me, initialCommentsOpen = false, likeOverride, likePop = false, onClose, onReact, onSave, onRepost, onShare, onComment, onReport, onHide, onToggleComments, onDelete,
}: Props) {
  useOverlayHistory(onClose);
  // The viewer is rendered on document.body so no ancestor stacking context
  // (transform, filter, contain, z-index) can put the bottom nav above it.
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [menu, setMenu] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(initialCommentsOpen);
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
  const liked = likeOverride?.liked ?? (!!me && row.vibes.some((vibe) => vibe.user_id === me));
  const vibeCount = Math.max(0, row.vibes.length + (likeOverride?.delta ?? 0));
  const closeComments = useCallback(() => setCommentsOpen(false), []);

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
  }, [isClient]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
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

  if (!isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] isolate overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="Post viewer">
      {media[0]?.type === "video" ? (
        <video
          ref={videoRef}
          src={media[0].url}
          poster={media[0].poster ?? media[0].thumbnail}
          autoPlay
          loop
          muted={false}
          playsInline
          onPlay={(event) => { activateVideo(event.currentTarget); setPlaying(true); }}
          onPause={() => setPlaying(false)}
          onClick={togglePlayback}
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : media[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media[0].url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-8 text-center">
          <p className="max-w-2xl whitespace-pre-wrap text-2xl font-semibold">{shown.body}</p>
        </div>
      )}

      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/85" />
      <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <button onClick={onClose} aria-label="Close post" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/45"><X className="h-5 w-5" /></button>
        <Link href={`/${author.username}`} className="flex min-w-0 flex-1 items-center gap-2">
          <Avatar p={author} size="h-10 w-10" />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{author.name || author.username}</span><span className="block truncate text-xs text-white/65">@{author.username} · {ago(row.created_at)}</span></span>
        </Link>
        <div className="relative">
          <button onClick={() => setMenu((value) => !value)} aria-label="More post options" className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45"><Ellipsis className="h-5 w-5" /></button>
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
          <span className="rounded-full bg-black/55 p-5 text-white/95">{playing ? <span className="block h-8 w-8 text-center text-2xl leading-8">❚❚</span> : <span className="block h-8 w-8 text-center text-2xl leading-8">▶</span>}</span>
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
          <button onClick={() => onReact(row.type === "struggle" ? "support" : "vibe")} aria-label={row.type === "struggle" ? "Support" : "Vibe"} className={`${rail} transition-transform duration-200 active:scale-125 ${likePop ? "scale-125" : ""} ${liked ? "text-pink-300" : ""}`}><Flame className={`h-6 w-6 ${liked ? "fill-current text-pink-400" : ""}`} />{vibeCount}</button>
          <button onClick={() => setCommentsOpen(true)} aria-label="Open comments" className={rail}><MessageCircle className="h-6 w-6" />{row.comments.length}</button>
          <button onClick={onRepost} disabled={row.share_policy === "nobody" && !mine} aria-label="Repost" className={rail}><Repeat2 className="h-6 w-6" /></button>
          <button onClick={onShare} aria-label="Share" className={rail}><Share2 className="h-6 w-6" /></button>
          <button onClick={onSave} aria-label="Save post" className={`${rail} ${saved ? "text-yellow-300" : ""}`}><Bookmark className={`h-6 w-6 ${saved ? "fill-current" : ""}`} /></button>
        </div>
      </div>

      {commentsOpen ? <CommentsSheet row={row} me={me} onClose={closeComments} onComment={onComment} /> : null}
    </div>,
    document.body,
  );
}

export default memo(PostViewer);