// path: maestra-vibe/components/DbFeed.tsx  (poori file replace karo)
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bookmark, Clapperboard, Flame, HandHeart, ImagePlus, MessageCircle, Play, Repeat2, Share2, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useColorMode } from "@/lib/theme";
import { typeMeta } from "@/components/postMeta";
import PostComposer from "@/components/PostComposer";
import ShortsViewer from "@/components/ShortsViewer";
import PostViewer, { Avatar, ago, mediaOf, type Orig, type Row } from "@/components/PostViewer";

const SELECT =
  "id,type,title,body,tags,location,media,image_url,created_at,user_id,comment_policy,comments_closed,share_policy,repost_of," +
  "profiles!posts_user_id_fkey(username,name,avatar_url,style),vibes(user_id),saves(user_id)," +
  "comments(id,body,pinned,created_at,user_id,profiles!comments_user_id_fkey(username,name,avatar_url))";
const ORIG = "id,title,body,image_url,media,profiles!posts_user_id_fkey(username,name,avatar_url)";
const BRAND = "bg-linear-to-r from-violet-600 via-fuchsia-500 to-blue-500";
const card = "home-feed-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm";
const act = "flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-base text-slate-600 hover:bg-slate-100 active:scale-95 disabled:opacity-40";
const TABS = ["For you", "Following", "Videos"] as const;
const isVideo = (r: Row) => mediaOf(r.original ?? r)[0]?.type === "video";

export default function DbFeed() {
  const { mode } = useColorMode();
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<Row[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [following, setFollowing] = useState<string[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("For you");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [shorts, setShorts] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [hidden, setHidden] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const deepLinked = useRef(false);

  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(""), 2200); };
  const fail = (e: unknown) => {
    const m = (e as { message?: string })?.message ?? "Something went wrong.";
    setError(/row-level security|permission denied/i.test(m) ? "The author has limited this action on the post." : m);
  };

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setMe(user?.id ?? null);
    if (user) {
      const { data: f } = await supabase.from("follows").select("followed_id").eq("follower_id", user.id);
      setFollowing((f ?? []).map((x) => x.followed_id as string));
    }
    const { data, error: err } = await supabase.from("posts").select(SELECT).order("created_at", { ascending: false }).limit(40);
    if (err) {
      setError(/column|schema cache/i.test(err.message) ? "Database update needed: run supabase/migrations/post_settings.sql in the Supabase SQL Editor." : err.message);
      setLoading(false);
      return;
    }
    const list = (data as unknown as Row[]) ?? [];
    const ids = [...new Set(list.map((r) => r.repost_of).filter((x): x is string => !!x))];
    if (ids.length) {
      const { data: originals } = await supabase.from("posts").select(ORIG).in("id", ids);
      const map = new Map(((originals ?? []) as unknown as Orig[]).map((o) => [o.id, o]));
      list.forEach((r) => { r.original = r.repost_of ? map.get(r.repost_of) ?? null : null; });
    }
    setRows(list);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    try { setHidden(JSON.parse(localStorage.getItem("mv-hidden") ?? "[]")); } catch { /* ignore */ }
  }, [load]);

  useEffect(() => {
    if (deepLinked.current || !rows.length) return;
    deepLinked.current = true;
    const id = new URLSearchParams(window.location.search).get("post");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id && rows.some((r) => r.id === id)) setOpenId(id);
  }, [rows]);

  const run = async (job: PromiseLike<{ error: { message: string } | null }>) => {
    const { error: err } = await job;
    if (err) fail(err);
    await load();
  };
  const need = () => setError("Log in to do that.");

  const vibe = (r: Row) => !me ? need() : run(r.vibes.some((v) => v.user_id === me) ? supabase.from("vibes").delete().eq("post_id", r.id).eq("user_id", me) : supabase.from("vibes").insert({ post_id: r.id, user_id: me }));
  const save = (r: Row) => !me ? need() : run(r.saves.some((s) => s.user_id === me) ? supabase.from("saves").delete().eq("post_id", r.id).eq("user_id", me) : supabase.from("saves").insert({ post_id: r.id, user_id: me }));
  const repost = async (r: Row) => {
    if (!me) return need();
    await run(supabase.from("posts").insert({ user_id: me, type: r.type, body: "", repost_of: r.repost_of ?? r.id }));
    flash("Reposted to your profile");
  };
  const comment = (r: Row, body: string) => !me ? need() : run(supabase.from("comments").insert({ post_id: r.id, user_id: me, body }));
  const hide = (r: Row) => {
    const next = [...hidden, r.id];
    setHidden(next);
    try { localStorage.setItem("mv-hidden", JSON.stringify(next)); } catch { /* ignore */ }
  };
  const report = async (r: Row, reason: string) => {
    if (!me) return need();
    await run(supabase.from("reports").insert({ reporter_id: me, post_id: r.id, reason: reason.slice(0, 300) }));
    hide(r);
    flash("Thanks. We will review this post.");
  };
  const remove = async (r: Row) => { setOpenId(null); await run(supabase.from("posts").delete().eq("id", r.id)); };
  const toggleComments = (r: Row) => run(supabase.from("posts").update({ comment_policy: r.comment_policy === "off" ? "everyone" : "off" }).eq("id", r.id));
  const share = async (r: Row) => {
    const url = `${window.location.origin}/?post=${r.id}`;
    if (navigator.share) { try { await navigator.share({ title: r.title || "Maestra Vibe", url }); return; } catch { /* user cancelled */ } }
    await navigator.clipboard?.writeText(url);
    flash("Link copied");
  };

  const notHidden = rows.filter((r) => !hidden.includes(r.id));
  const visible = notHidden.filter((r) => tab === "Following" ? r.user_id === me || following.includes(r.user_id) : tab === "Videos" ? isVideo(r) : true);
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <section data-mode={mode} aria-label="Community feed" className="home-feed mx-auto max-w-3xl space-y-4 px-0 py-3 sm:py-5">
      {me ? (
        <div className={`${card} flex items-center gap-2 p-3`}>
          <button onClick={() => setCreating(true)} className="h-12 flex-1 rounded-full bg-slate-100 px-4 text-left text-base text-slate-500 hover:bg-slate-200">What is your vibe today?</button>
          <button onClick={() => setCreating(true)} aria-label="Add photo" className="flex h-12 w-12 items-center justify-center rounded-full text-violet-500 hover:bg-slate-100"><ImagePlus className="h-6 w-6" /></button>
          <button onClick={() => setCreating(true)} aria-label="Add video" className="flex h-12 w-12 items-center justify-center rounded-full text-pink-500 hover:bg-slate-100"><Video className="h-6 w-6" /></button>
        </div>
      ) : !loading ? (
        <Link href="/login" className={`${card} block p-4 text-center text-base text-slate-600 hover:bg-slate-50`}>Log in or sign up to share your vibe</Link>
      ) : null}

      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1 rounded-full bg-slate-100 p-1" role="tablist" aria-label="Feed sections">
          {TABS.map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-10 flex-1 rounded-full text-sm font-medium ${tab === t ? `${BRAND} text-white shadow` : "text-slate-600"}`}>{t}</button>)}
        </div>
        <button onClick={() => setShorts(true)} className={`flex h-12 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white ${BRAND}`}><Clapperboard className="h-5 w-5" aria-hidden="true" />Shorts</button>
      </div>

      {note ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{note}</p> : null}
      {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="py-10 text-center text-slate-500">Loading posts...</p> : visible.length === 0 && !error ? <p className="py-10 text-center text-slate-500">{tab === "Following" ? "Follow people to see their posts here." : "Nothing here yet. Be the first to share your vibe."}</p> : null}

      {visible.map((r) => {
        const a = r.profiles;
        const shown = r.original ?? r;
        const m = mediaOf(shown)[0];
        const meta = typeMeta[r.type] ?? typeMeta.vibe;
        const liked = !!me && r.vibes.some((v) => v.user_id === me);
        const saved = !!me && r.saves.some((s) => s.user_id === me);
        return (
          <article key={r.id} className={card}>
            <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${meta.color}, #8b5cf6, #3b82f6)` }} />
            <div className="p-4">
              <header className="mb-3 flex items-center gap-3">
                <Link href={`/${a.username}`}><Avatar p={a} size="h-12 w-12" /></Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/${a.username}`} className="block truncate text-base font-semibold hover:underline">{a.name || a.username}</Link>
                  <p className="truncate text-sm text-slate-500">@{a.username} · {ago(r.created_at)}{r.repost_of ? " · reposted" : ""}</p>
                </div>
                <span className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: `${meta.color}22`, color: meta.color }}><meta.Icon className="h-4 w-4" aria-hidden="true" />{meta.label}</span>
              </header>

              <button onClick={() => setOpenId(r.id)} className="block w-full text-left" aria-label="Open post">
                {shown.title ? <h3 className="mb-1 text-lg font-bold">{shown.title}</h3> : null}
                {r.body ? <p className="whitespace-pre-wrap text-base leading-relaxed">{r.body}</p> : null}
                {r.original && !r.body ? <p className="text-sm text-slate-500">@{r.original.profiles.username}: {r.original.body.slice(0, 160)}</p> : null}
                {m ? (
                  <span className="relative mt-3 block overflow-hidden rounded-xl bg-black">
                    {m.type === "video" ? (
                      <>
                        <video src={`${m.url}#t=0.1`} preload="metadata" muted playsInline className="max-h-[70vh] w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-black/60 p-5 text-white"><Play className="h-8 w-8" /></span></span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="max-h-[70vh] w-full object-cover" />
                    )}
                  </span>
                ) : null}
              </button>

              <footer className="-mx-2 mt-3 flex items-center">
                <button onClick={() => void vibe(r)} className={`${act} ${liked ? "font-semibold text-orange-500" : ""}`} aria-label={r.type === "struggle" ? "Support" : "Vibe"}>{r.type === "struggle" ? <HandHeart className="h-6 w-6" /> : <Flame className="h-6 w-6" />}{r.vibes.length}</button>
                <button onClick={() => setOpenId(r.id)} className={act} aria-label="Comments"><MessageCircle className="h-6 w-6" />{r.comments.length}</button>
                <button onClick={() => void repost(r)} disabled={r.share_policy === "nobody" && r.user_id !== me} className={act} aria-label="Repost"><Repeat2 className="h-6 w-6" /></button>
                <button onClick={() => void share(r)} className={act} aria-label="Share"><Share2 className="h-6 w-6" /></button>
                <button onClick={() => void save(r)} className={`${act} ml-auto ${saved ? "text-yellow-500" : ""}`} aria-label="Save"><Bookmark className={`h-6 w-6 ${saved ? "fill-current" : ""}`} /></button>
              </footer>
            </div>
          </article>
        );
      })}

      {shorts ? <ShortsViewer rows={notHidden.filter(isVideo)} me={me} onClose={() => setShorts(false)} onVibe={(r) => void vibe(r)} onOpen={(r) => setOpenId(r.id)} onShare={(r) => void share(r)} /> : null}
      {open ? (
        <PostViewer
          row={open} me={me} onClose={() => setOpenId(null)}
          onVibe={() => void vibe(open)} onSave={() => void save(open)} onRepost={() => void repost(open)} onShare={() => void share(open)}
          onComment={(b) => void comment(open, b)} onReport={(why) => void report(open, why)} onHide={() => hide(open)}
          onToggleComments={() => void toggleComments(open)} onDelete={() => void remove(open)}
        />
      ) : null}
      {creating && me ? <PostComposer me={me} onClose={() => setCreating(false)} onPublished={() => { setCreating(false); void load(); flash("Your post is live"); }} /> : null}
    </section>
  );
}