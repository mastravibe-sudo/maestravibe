"use client";

import type { PostType } from "@/lib/posts";

export type Media = { type: "image" | "video"; url: string; poster?: string; thumbnail?: string; width?: number; height?: number; bytes?: number };
export type Person = { username: string; name: string | null; avatar_url: string | null };
export type CommentRow = { id: string; body: string; pinned: boolean; created_at: string; user_id: string; profiles: Person };
export type Orig = { id: string; title: string | null; body: string; image_url: string | null; media: Media[] | null; profiles: Person };
export type Row = {
  id: string; type: PostType; title: string | null; body: string; tags: string[] | null; location: string | null;
  media: Media[] | null; image_url: string | null; created_at: string; user_id: string;
  comment_policy: "everyone" | "followers" | "off"; comments_closed: boolean;
  share_policy: "everyone" | "followers" | "nobody"; repost_of: string | null;
  profiles: Person & { style: { accent?: string } | null };
  vibes: { user_id: string; kind?: string }[]; saves: { user_id: string }[]; comments: CommentRow[]; original?: Orig | null;
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
      {p.avatar_url ? <img src={p.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : (p.name || p.username).slice(0, 1).toUpperCase()}
    </span>
  );
}
