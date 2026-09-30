// path: maestra-vibe/components/Feed.tsx  (poori file replace karo)
"use client";

import { useState } from "react";
import Link from "next/link";
import { profiles, rgba } from "@/lib/profiles";
import { typeInfo, type Post, type PostType } from "@/lib/posts";
import { ME, useStore } from "@/lib/store";

const user = (u: string) => profiles.find((p) => p.username === u)!;

// Photo ko chhota karke WebP banata hai (free storage bachane ke liye)
function compress(file: File): Promise<string> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, 720 / img.width);
      const c = document.createElement("canvas");
      c.width = img.width * k;
      c.height = img.height * k;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/webp", 0.7));
    };
    img.src = URL.createObjectURL(file);
  });
}

function PostCard({ post, embedded = false }: { post: Post; embedded?: boolean }) {
  const st = useStore();
  const { s } = st;
  const a = user(post.username);
  const orig = post.repostOf ? s.posts.find((p) => p.id === post.repostOf) : undefined;
  const target = orig ?? post;
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");

  const mine = post.username === ME;
  const closed = s.closed.includes(post.id);
  const list = s.comments
    .filter((c) => c.postId === post.id)
    .sort((x, y) => Number(y.pinned) - Number(x.pinned));
  const liked = post.vibed.includes(ME);
  const count = post.vibes + post.vibed.length;
  const flash = (t: string) => {
    setNote(t);
    setTimeout(() => setNote(""), 1800);
  };

  return (
    <article
      className={`rounded-2xl border border-white/10 p-5 ${embedded ? "bg-zinc-950" : "bg-zinc-900"}`}
      style={{ borderLeft: `4px solid ${a.style.accent}` }}
    >
      {post.repostOf && !embedded && <p className="mb-2 text-xs text-zinc-500">🔁 {a.name} reposted</p>}

      <header className="mb-3 flex items-center gap-3">
        <Link
          href={`/${a.username}`}
          className="flex h-11 w-11 items-center justify-center rounded-full text-xl"
          style={{ background: rgba(a.style.accent, 0.9) }}
        >
          {a.avatar}
        </Link>
        <div className="flex-1">
          <Link href={`/${a.username}`} className="font-semibold hover:underline">
            {a.name}
          </Link>
          <p className="text-sm text-zinc-500">
            @{a.username} · {post.time}
          </p>
        </div>
        {!post.repostOf && (
          <span
            className="rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: rgba(a.style.accent, 0.2), color: a.style.accent }}
          >
            {typeInfo[post.type].icon} {typeInfo[post.type].label}
          </span>
        )}
        {!embedded && !mine && (
          <div className="relative">
            <button onClick={() => setMenu(!menu)} className="px-2 text-zinc-500 hover:text-white">
              ⋯
            </button>
            {menu && (
              <div className="absolute right-0 z-10 w-44 rounded-xl border border-white/10 bg-zinc-800 p-1 text-sm shadow-xl">
                <button
                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => {
                    const r = prompt("Reason for report (spam / harassment / fake / other):");
                    if (r) st.report(post.id, r);
                    setMenu(false);
                  }}
                >
                  🚩 Report
                </button>
                <button
                  className="block w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => {
                    if (confirm(`Block @${a.username}?`)) st.block(a.username);
                    setMenu(false);
                  }}
                >
                  🚫 Block @{a.username}
                </button>
              </div>
            )}
          </div>
        )}
      </header>

      {post.text && <p className="text-lg leading-relaxed">{post.text}</p>}
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image} alt="" className="mt-3 max-h-96 w-full rounded-xl object-cover" />
      )}
      {orig && !embedded && (
        <div className="mt-3">
          <PostCard post={orig} embedded />
        </div>
      )}

      {!embedded && (
        <>
          <footer className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-zinc-400">
            <button
              onClick={() => st.vibe(post.id)}
              className={liked ? "font-semibold text-orange-400" : "hover:text-white"}
            >
              {post.type === "struggle" ? "🤝 Support" : "🔥 Vibe"} {count}
            </button>
            <button onClick={() => setOpen(!open)} className="hover:text-white">
              💬 {list.length}
            </button>
            <button
              className="hover:text-white"
              onClick={() => {
                st.addPost(target.type, "", undefined, { repostOf: target.id });
                flash("Reposted ✓");
              }}
            >
              🔁 Repost
            </button>
            <button
              className="hover:text-white"
              onClick={() => {
                const q = prompt("Add your comment:");
                if (q) st.addPost(target.type, q, undefined, { repostOf: target.id });
              }}
            >
              ✍️ Quote
            </button>
            <button
              className="hover:text-white"
              onClick={() => {
                navigator.clipboard?.writeText(`${location.origin}/${target.username}`);
                flash("Link copied ✓");
              }}
            >
              📩 Send
            </button>
            <button
              onClick={() => st.save(post.id)}
              className={s.saved.includes(post.id) ? "text-yellow-300" : "hover:text-white"}
            >
              🔖 {s.saved.includes(post.id) ? "Saved" : "Save"}
            </button>
            {target.type === "dream" && target.username !== ME && (
              <button
                className="text-violet-300 hover:text-violet-200"
                onClick={() => {
                  st.adoptDream(target.text);
                  flash("Added to your dreams 🌠");
                }}
              >
                🌠 I share this dream
              </button>
            )}
            {note && <span className="text-emerald-400">{note}</span>}
          </footer>

          {open && (
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
              {mine && (
                <button onClick={() => st.toggleComments(post.id)} className="text-xs text-zinc-500 hover:text-white">
                  {closed ? "🔓 Turn comments on" : "🔒 Turn comments off"}
                </button>
              )}
              {list.map((c) => (
                <div key={c.id} className="text-sm">
                  <span className="font-semibold">{user(c.username).name}</span>{" "}
                  {c.pinned && <span className="text-xs text-violet-300">📌 pinned</span>}
                  <p className="text-zinc-300">{c.text}</p>
                  {mine && (
                    <button onClick={() => st.pin(c.id)} className="text-xs text-zinc-500 hover:text-white">
                      {c.pinned ? "Unpin" : "Pin"}
                    </button>
                  )}
                </div>
              ))}
              {closed ? (
                <p className="text-sm text-zinc-500">Comments are turned off for this post.</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Write a comment..."
                    className="min-w-0 flex-1 rounded-full bg-zinc-800 px-4 py-2 text-sm outline-none"
                  />
                  <button
                    onClick={() => {
                      if (draft.trim()) {
                        st.comment(post.id, draft.trim());
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
        </>
      )}
    </article>
  );
}

const tabs = ["For You", "Following", "Saved", "🔔"] as const;

export default function Feed() {
  const st = useStore();
  const { s } = st;
  const [tab, setTab] = useState<(typeof tabs)[number]>("For You");
  const [type, setType] = useState<PostType>("vibe");
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | undefined>();
  const [search, setSearch] = useState("");

  const unread = s.notes.filter((n) => !n.read).length;
  const q = search.toLowerCase();

  const visible = s.posts
    .filter((p) => !s.blocked.includes(p.username) && !s.reports.some((r) => r.postId === p.id))
    .filter((p) =>
      tab === "Following" ? p.username === ME || s.following.includes(p.username) : tab === "Saved" ? s.saved.includes(p.id) : true
    )
    .filter((p) => !q || p.text.toLowerCase().includes(q) || p.username.includes(q) || user(p.username).name.toLowerCase().includes(q));

  const publish = () => {
    if (!text.trim() && !image) return;
    st.addPost(type, text.trim(), image);
    setText("");
    setImage(undefined);
  };

  return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search people or posts..."
        className="w-full rounded-full border border-white/10 bg-zinc-900 px-5 py-2.5 outline-none placeholder:text-zinc-600"
      />

      {/* Composer */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900 p-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's your vibe today?"
          rows={2}
          className="w-full resize-none bg-transparent text-lg outline-none placeholder:text-zinc-600"
        />
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="mb-2 max-h-48 rounded-xl" />
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(typeInfo) as PostType[]).map((k) => (
              <button
                key={k}
                onClick={() => setType(k)}
                className={`rounded-full px-3 py-1 text-sm ${type === k ? "bg-violet-500 text-white" : "bg-zinc-800 text-zinc-400"}`}
              >
                {typeInfo[k].icon} {typeInfo[k].label}
              </button>
            ))}
            <label className="cursor-pointer rounded-full bg-zinc-800 px-3 py-1 text-sm text-zinc-400 hover:text-white">
              📷 Photo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setImage(await compress(f));
                }}
              />
            </label>
          </div>
          <button onClick={publish} className="rounded-full bg-violet-500 px-5 py-1.5 font-medium text-white hover:bg-violet-400">
            Post
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              if (t === "🔔") st.readAll();
            }}
            className={`rounded-full px-4 py-1.5 text-sm ${tab === t ? "bg-white/10 font-semibold" : "text-zinc-500 hover:text-white"}`}
          >
            {t}
            {t === "🔔" && unread > 0 && <span className="ml-1 rounded-full bg-red-500 px-1.5 text-xs text-white">{unread}</span>}
          </button>
        ))}
      </div>

      {tab === "🔔" ? (
        <div className="space-y-2">
          {s.notes.map((n) => (
            <p key={n.id} className="rounded-xl bg-zinc-900 p-4 text-sm">
              {n.text}
            </p>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-zinc-500">
          {tab === "Following" ? "You're not following anyone yet. Use the panel on the right." : tab === "Saved" ? "No saved posts yet. Tap 🔖 to save." : "No posts found."}
        </p>
      ) : (
        visible.map((p) => <PostCard key={p.id} post={p} />)
      )}
    </main>
  );
}