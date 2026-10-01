// path: maestra-vibe/components/DbFeed.tsx  (NEW file)
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { typeInfo, type PostType } from "@/lib/posts";
import { useColorMode } from "@/lib/theme";

const rgba = (hex: string, alpha: number) => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
};

type Row = {
  id: string;
  type: PostType;
  body: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  comments_closed: boolean;
  profiles: { username: string; name: string; avatar: string; style: { accent?: string } | null };
  vibes: { user_id: string }[];
  comments: { id: string; body: string; pinned: boolean; created_at: string; profiles: { username: string; name: string } }[];
};

const ago = (d: string) => {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

// Photo ko chhota karke WebP banata hai (R2 ki free storage bachane ke liye)
function toWebp(file: File): Promise<Blob> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 900 / img.width);
      const c = document.createElement("canvas");
      c.width = img.width * k;
      c.height = img.height * k;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read image."))), "image/webp", 0.72);
    };
    img.onerror = () => rej(new Error("Could not read image."));
    img.src = URL.createObjectURL(file);
  });
}

function Card({ row, me, onVibe, onComment }: { row: Row; me: string | null; onVibe: () => void; onComment: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const a = row.profiles;
  const accent = a.style?.accent ?? "#2563eb";
  const liked = !!me && row.vibes.some((v) => v.user_id === me);
  const comments = [...row.comments].sort((x, y) => Number(y.pinned) - Number(x.pinned));

  return (
    <article className="home-feed-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" style={{ borderLeft: `4px solid ${accent}` }}>
      <header className="mb-3 flex items-center gap-3">
        <Link href={`/${a.username}`} className="flex h-11 w-11 items-center justify-center rounded-full text-xl" style={{ background: rgba(accent, 0.9) }}>
          {a.avatar}
        </Link>
        <div className="flex-1">
          <Link href={`/${a.username}`} className="font-semibold hover:underline">
            {a.name || a.username}
          </Link>
            <p className="text-sm text-slate-500">
            @{a.username} · {ago(row.created_at)}
          </p>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: rgba(accent, 0.2), color: accent }}>
          {typeInfo[row.type].icon} {typeInfo[row.type].label}
        </span>
      </header>

      {row.body && <p className="whitespace-pre-wrap text-lg leading-relaxed">{row.body}</p>}
      {row.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.image_url} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />
      )}

      <footer className="mt-4 flex gap-5 text-sm text-slate-500">
        <button onClick={onVibe} className={liked ? "font-semibold text-orange-400" : "hover:text-white"}>
          {row.type === "struggle" ? "🤝 Support" : "🔥 Vibe"} {row.vibes.length}
        </button>
        <button onClick={() => setOpen(!open)} className="hover:text-white">
          💬 {comments.length}
        </button>
      </footer>

      {open && (
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
          {comments.map((c) => (
            <div key={c.id} className="text-sm">
              <span className="font-semibold">{c.profiles.name || c.profiles.username}</span>{" "}
              {c.pinned && <span className="text-xs text-violet-300">📌 pinned</span>}
              <p className="text-slate-600">{c.body}</p>
            </div>
          ))}
          {row.comments_closed ? (
              <p className="text-sm text-slate-500">Comments are turned off for this post.</p>
          ) : (
            <div className="flex gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a comment..."
                className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                onClick={() => {
                  if (draft.trim()) {
                    onComment(draft.trim());
                    setDraft("");
                  }
                }}
                className="rounded-full bg-violet-500 px-4 py-2 text-sm font-medium text-white"
              >
                Comment
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function DbFeed() {
  const { mode } = useColorMode();
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<PostType>("vibe");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setMe(user?.id ?? null);
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id,type,body,image_url,created_at,user_id,comments_closed,profiles!posts_user_id_fkey(username,name,avatar,style),vibes(user_id),comments(id,body,pinned,created_at,profiles!comments_user_id_fkey(username,name))"
      )
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) setError(error.message);
    else setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const fail = (e: unknown) => setError((e as { message?: string })?.message ?? "Something went wrong.");

  const publish = async () => {
    if (!me || (!text.trim() && !file)) return;
    setBusy(true);
    setError("");
    try {
      let image_url: string | null = null;
      if (file) {
        const blob = await toWebp(file);
        const formData = new FormData();
        formData.append("purpose", "post");
        formData.append("file", blob, "post.webp");
        const r = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const result = (await r.json()) as { publicUrl?: string; error?: string };
        if (!r.ok || !result.publicUrl) throw new Error(result.error ?? "Upload failed.");
        image_url = result.publicUrl;
      }
      const { error } = await supabase.from("posts").insert({ user_id: me, type, body: text.trim(), image_url });
      if (error) throw error;
      setText("");
      setFile(null);
      await load();
    } catch (e) {
      fail(e);
    }
    setBusy(false);
  };

  const vibe = async (row: Row) => {
    if (!me) return setError("Log in to react to posts.");
    const liked = row.vibes.some((v) => v.user_id === me);
    const { error } = liked
      ? await supabase.from("vibes").delete().eq("post_id", row.id).eq("user_id", me)
      : await supabase.from("vibes").insert({ post_id: row.id, user_id: me });
    if (error) fail(error);
    await load();
  };

  const comment = async (row: Row, body: string) => {
    if (!me) return setError("Log in to comment.");
    const { error } = await supabase.from("comments").insert({ post_id: row.id, user_id: me, body });
    if (error) fail(error);
    await load();
  };

  return (
    <section data-mode={mode} aria-label="Community feed" className="home-feed mx-auto max-w-3xl space-y-4 px-0 py-3 sm:py-5">
      {me ? (
        <div className="home-feed-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's your vibe today?"
            rows={2}
            className="w-full resize-none bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          />
          {file && <p className="text-sm text-slate-500">📷 {file.name}</p>}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(typeInfo) as PostType[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setType(k)}
                  className={`rounded-full px-3 py-1 text-sm ${type === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {typeInfo[k].icon} {typeInfo[k].label}
                </button>
              ))}
              <label className="cursor-pointer rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600 hover:bg-slate-200">
                📷 Photo
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            <button
              onClick={publish}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {busy ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      ) : (
        !loading && (
          <Link href="/login" className="home-feed-card block rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-600 shadow-sm hover:bg-slate-50">
            Log in or sign up to share your vibe
          </Link>
        )
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="py-10 text-center text-slate-500">Loading posts...</p>
      ) : rows.length === 0 ? (
        <p className="py-10 text-center text-slate-500">No posts yet. Be the first to share your vibe.</p>
      ) : (
        rows.map((r) => <Card key={r.id} row={r} me={me} onVibe={() => vibe(r)} onComment={(t) => comment(r, t)} />)
      )}
    </section>
  );
}