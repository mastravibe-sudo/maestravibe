"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Send, Smile, Sticker, X } from "lucide-react";
import { EMOJIS, STICKERS, stickerOf, stickerToken } from "@/lib/stickers";
import { useOverlayHistory } from "@/lib/useOverlayHistory";
import { Avatar, ago, type Row } from "@/components/postUtils";

type Props = {
  row: Row;
  me: string | null;
  onClose: () => void;
  onComment: (body: string) => void;
};

const subscribeNoop = () => () => undefined;

/**
 * Bottom-sheet comments panel. Rendered through a portal on document.body so
 * it always sits above the bottom navigation and any ancestor stacking context.
 * Used by PostViewer and by the For You / Shorts comment button.
 */
export default function CommentsSheet({ row, me, onClose, onComment }: Props) {
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const [draft, setDraft] = useState("");
  const [tray, setTray] = useState<"emoji" | "sticker" | null>(null);
  const closed = row.comments_closed || row.comment_policy === "off";
  const comments = [...row.comments].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || a.created_at.localeCompare(b.created_at),
  );

  // Android back / browser back closes the sheet instead of leaving the screen.
  useOverlayHistory(onClose);

  useEffect(() => {
    // Capture phase + stopImmediatePropagation so a parent PostViewer's Escape
    // handler does not also close the whole viewer.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const send = () => {
    if (!draft.trim() || closed) return;
    onComment(draft.trim());
    setDraft("");
    setTray(null);
  };

  if (!isClient) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[230] flex items-end bg-black/45"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Comments"
        className="flex max-h-[78dvh] w-full flex-col rounded-t-3xl border border-white/10 bg-[#141028] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-white shadow-2xl sm:mx-auto sm:max-w-xl"
      >
        <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
          <h2 className="text-sm font-semibold">Comments <span className="text-white/55">{comments.length}</span></h2>
          <button onClick={onClose} aria-label="Close comments" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><X className="h-5 w-5" /></button>
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
    </div>,
    document.body,
  );
}