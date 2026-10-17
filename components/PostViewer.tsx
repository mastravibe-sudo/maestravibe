// path: maestra-vibe/components/PostViewer.tsx  (NEW file)
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bookmark, Ellipsis, EyeOff, Flag, Flame, HandHeart, Link2, LockKeyhole, MapPin, MessageCircle, Repeat2, Send, Share2, Smile, Sticker, Trash2, X } from "lucide-react";
import type { PostType } from "@/lib/posts";
import { EMOJIS, STICKERS, stickerOf, stickerToken } from "@/lib/stickers";
import { typeMeta } from "@/components/postMeta";

export type Media = { type: "image" | "video"; url: string; width?: number; height?: number; bytes?: number };
export type Person = { username: string; name: string | null; avatar_url: string | null };
export type CommentRow = { id: string; body: string; pinned: boolean; created_at: string; user_id: string; profiles: Person };
export type Orig = { id: string; title: string | null; body: string; image_url: string | null; media: Media[] | null; profiles: Person };
export type Row = {
  id: string; type: PostType; title: string | null; body: string; tags: string[] | null; location: string | null;
  media: Media[] | null; image_url: string | null; created_at: string; user_id: string;
  comment_policy: "everyone" | "followers" | "off"; comments_closed: boolean;
  share_policy: "everyone" | "followers" | "nobody"; repost_of: string | null;
  profiles: Person & { style: { accent?: string } | null };
  vibes: { user_id: string }[]; saves: { user_id: string }[]; comments: CommentRow[]; original?: Orig | null;
};

export const mediaOf = (r: { media?: Media[] | null; image_url: string | null }): Media[] =>
  r.media && r.media.length ? r.media : r.image_url ? [{ type: "image", url: r.image_url }] : [];

export const ago = (d: string) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

export function Avatar({ p, size = "h-10 w-10" }: { p: Person; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-700 text-sm font-semibold text-white`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-full w-full object-cover" /> : (p.name || p.username).slice(0, 1).toUpperCase()}
    </span>
  );
}

type Props = {
  row: Row; me: string | null;
  onClose: () => void; onVibe: () => void; onSave: () => void; onRepost: () => void; onShare: () => void;
  onComment: (body: string) => void; onReport: (reason: string) => void; onHide: () => void;
  onToggleComments: () => void; onDelete: () => void;
};

const act = "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-300 hover:bg-white/10 disabled:opacity-40";
const menuItem = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10";

export default function PostViewer({ row, me, onClose, onVibe, onSave, onRepost, onShare, onComment, onReport, onHide, onToggleComments, onDelete }: Props) {
  const [draft, setDraft] = useState("");
  const [tray, setTray] = useState<"emoji" | "sticker" | null>(null);
  const [menu, setMenu] = useState(false);
  const shown = row.original ?? row;
  const media = mediaOf(shown);
  const a = row.profiles;
  const mine = me === row.user_id;
  const liked = !!me && row.vibes.some((v) => v.user_id === me);
  const saved = !!me && row.saves.some((s) => s.user_id === me);
  const closed = row.comments_closed || row.comment_policy === "off";
  const TypeIcon = (typeMeta[row.type] ?? typeMeta.vibe).Icon;
  const comments = [...row.comments].sort((x, y) => Number(y.pinned) - Number(x.pinned) || x.created_at.localeCompare(y.created_at));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const send = () => {
    if (!draft.trim()) return;
    onComment(draft.trim());
    setDraft("");
    setTray(null);
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 lg:flex-row" role="dialog" aria-modal="true" aria-label="Post">
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-2" onClick={onClose}>
        <button onClick={onClose} aria-label="Close" className="absolute left-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white"><X className="h-5 w-5" /></button>
        {media[0]?.type === "video" ? (
          <video src={media[0].url} controls autoPlay loop playsInline onClick={stop} className="max-h-full max-w-full" />
        ) : media[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media[0].url} alt="" onClick={stop} className="max-h-full max-w-full object-contain" />
        ) : (
          <p onClick={stop} className="max-w-md whitespace-pre-wrap p-6 text-center text-xl text-white">{shown.body}</p>
        )}
      </div>

      <aside className="flex max-h-[58vh] w-full flex-col bg-zinc-900 text-zinc-100 lg:max-h-none lg:w-[400px]">
        <header className="flex items-center gap-3 border-b border-white/10 p-3">
          <Link href={`/${a.username}`}><Avatar p={a} /></Link>
          <div className="min-w-0 flex-1">
            <Link href={`/${a.username}`} className="block truncate text-sm font-semibold hover:underline">{a.name || a.username}</Link>
            <p className="flex items-center gap-1 truncate text-xs text-zinc-400"><TypeIcon className="h-3 w-3" aria-hidden="true" />@{a.username} · {ago(row.created_at)}</p>
          </div>
          <div className="relative">
            <button onClick={() => setMenu(!menu)} aria-label="More options" className="rounded-full p-2 hover:bg-white/10"><Ellipsis className="h-5 w-5" /></button>
            {menu ? (
              <div className="absolute right-0 z-10 w-52 rounded-xl border border-white/10 bg-zinc-800 p-1 shadow-xl">
                <button className={menuItem} onClick={() => { onShare(); setMenu(false); }}><Link2 className="h-4 w-4" />Copy link</button>
                {mine ? (
                  <>
                    <button className={menuItem} onClick={() => { onToggleComments(); setMenu(false); }}><LockKeyhole className="h-4 w-4" />{closed ? "Turn comments on" : "Turn comments off"}</button>
                    <button className={`${menuItem} text-red-300`} onClick={() => { if (confirm("Delete this post?")) onDelete(); }}><Trash2 className="h-4 w-4" />Delete post</button>
                  </>
                ) : (
                  <>
                    <button className={menuItem} onClick={() => { onHide(); onClose(); }}><EyeOff className="h-4 w-4" />Not interested</button>
                    <button className={menuItem} onClick={() => { const r = prompt("Why are you reporting this post? (spam, harassment, fake, other)"); if (r) { onReport(r); onClose(); } setMenu(false); }}><Flag className="h-4 w-4" />Report</button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {shown.title ? <h2 className="text-lg font-bold">{shown.title}</h2> : null}
          {row.body ? <p className="whitespace-pre-wrap text-sm leading-relaxed">{row.body}</p> : null}
          {row.original ? (
            <div className="rounded-xl border border-white/10 p-3 text-sm">
              <p className="mb-1 flex items-center gap-1 text-xs text-zinc-400"><Repeat2 className="h-3.5 w-3.5" />Reposted from @{row.original.profiles.username}</p>
              <p className="whitespace-pre-wrap">{row.original.body}</p>
            </div>
          ) : null}
          {row.tags?.length ? <p className="flex flex-wrap gap-2 text-sm text-blue-300">{row.tags.map((t) => <span key={t}>#{t}</span>)}</p> : null}
          {row.location ? <p className="flex items-center gap-1 text-xs text-zinc-400"><MapPin className="h-3.5 w-3.5" />{row.location}</p> : null}

          <div className="space-y-3 border-t border-white/10 pt-4">
            {comments.length === 0 ? <p className="text-sm text-zinc-500">No comments yet.</p> : null}
            {comments.map((c) => {
              const s = stickerOf(c.body);
              return (
                <div key={c.id} className="flex gap-2">
                  <Link href={`/${c.profiles.username}`}><Avatar p={c.profiles} size="h-8 w-8" /></Link>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{c.profiles.name || c.profiles.username} <span className="font-normal text-zinc-500">{ago(c.created_at)}</span></p>
                    {s ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.src} alt={s.label} className="mt-1 h-16 w-16" />
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm text-zinc-300">{c.body}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <footer className="border-t border-white/10 p-3">
          <div className="mb-2 flex items-center">
            <button onClick={onVibe} className={`${act} ${liked ? "text-orange-400" : ""}`} aria-label={row.type === "struggle" ? "Support" : "Vibe"}>
              {row.type === "struggle" ? <HandHeart className="h-5 w-5" /> : <Flame className="h-5 w-5" />}{row.vibes.length}
            </button>
            <span className={act}><MessageCircle className="h-5 w-5" />{comments.length}</span>
            <button onClick={onRepost} disabled={row.share_policy === "nobody" && !mine} className={act} aria-label="Repost"><Repeat2 className="h-5 w-5" /></button>
            <button onClick={onShare} className={act} aria-label="Share"><Share2 className="h-5 w-5" /></button>
            <button onClick={onSave} className={`${act} ml-auto`} aria-label="Save"><Bookmark className={`h-5 w-5 ${saved ? "fill-current text-yellow-300" : ""}`} /></button>
          </div>

          {closed ? (
            <p className="flex items-center gap-2 text-sm text-zinc-500"><LockKeyhole className="h-4 w-4" />Comments are turned off for this post.</p>
          ) : me ? (
            <div>
              {tray === "emoji" ? (
                <div className="mb-2 grid max-h-28 grid-cols-8 gap-1 overflow-y-auto rounded-lg bg-zinc-800 p-2 text-xl">
                  {EMOJIS.map((e) => <button key={e} onClick={() => setDraft((d) => d + e)} className="rounded hover:bg-white/10">{e}</button>)}
                </div>
              ) : null}
              {tray === "sticker" ? (
                <div className="mb-2 grid grid-cols-4 gap-2 rounded-lg bg-zinc-800 p-2">
                  {STICKERS.map((s) => (
                    <button key={s.id} onClick={() => { onComment(stickerToken(s.id)); setTray(null); }} className="rounded p-1 hover:bg-white/10" aria-label={s.label}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.src} alt="" className="h-12 w-12" />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-center gap-1">
                <button onClick={() => setTray(tray === "emoji" ? null : "emoji")} aria-label="Emoji" className="rounded-full p-2 hover:bg-white/10"><Smile className="h-5 w-5" /></button>
                <button onClick={() => setTray(tray === "sticker" ? null : "sticker")} aria-label="Stickers" className="rounded-full p-2 hover:bg-white/10"><Sticker className="h-5 w-5" /></button>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Add a comment..." className="min-w-0 flex-1 rounded-full bg-zinc-800 px-4 py-2 text-sm outline-none placeholder:text-zinc-500" />
                <button onClick={send} aria-label="Send comment" className="rounded-full bg-blue-600 p-2 text-white hover:bg-blue-500"><Send className="h-4 w-4" /></button>
              </div>
            </div>
          ) : (
            <Link href="/login" className="block rounded-lg bg-blue-600 py-2 text-center text-sm font-semibold text-white">Log in to comment</Link>
          )}
        </footer>
      </aside>
    </div>
  );
}