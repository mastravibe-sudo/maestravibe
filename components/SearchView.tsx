// path: maestra-vibe/components/SearchView.tsx  (NEW file)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, mediaOf, type Media } from "@/components/PostViewer";

type Person = { id: string; username: string; name: string | null; bio: string | null; avatar_url: string | null };
type Hit = { id: string; title: string | null; body: string; image_url: string | null; media: Media[] | null; profiles: { username: string; name: string | null; avatar_url: string | null } };
const BRAND = "bg-linear-to-r from-violet-600 via-fuchsia-500 to-blue-500";
// Doosre platforms ki apni search khulti hai (unka data hamare andar nahi aata)
const ELSEWHERE = [
  { name: "Google", href: (q: string) => `https://www.google.com/search?q=${q}` },
  { name: "YouTube", href: (q: string) => `https://www.youtube.com/results?search_query=${q}` },
  { name: "TikTok", href: (q: string) => `https://www.tiktok.com/search?q=${q}` },
  { name: "Facebook", href: (q: string) => `https://www.facebook.com/search/top?q=${q}` },
];

export default function SearchView() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"people" | "posts">("people");
  const [people, setPeople] = useState<Person[]>([]);
  const [posts, setPosts] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initial) setQ(initial);
  }, []);

  useEffect(() => {
    const term = q.trim().replace(/^#/, "").replace(/[,(){}"%*\\]/g, " ").trim().slice(0, 60);
    if (term.length < 2) { setPeople([]); setPosts([]); return; }
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      const tag = term.toLowerCase().replace(/[^a-z0-9_]/g, "");
      const clauses = [`title.ilike.%${term}%`, `body.ilike.%${term}%`, ...(tag ? [`tags.cs.{${tag}}`] : [])].join(",");
      const [p, s] = await Promise.all([
        supabase.from("profiles").select("id,username,name,bio,avatar_url").eq("discoverable", true).or(`username.ilike.%${term}%,name.ilike.%${term}%`).limit(20),
        supabase.from("posts").select("id,title,body,image_url,media,profiles!posts_user_id_fkey!inner(username,name,avatar_url,discoverable)").eq("profiles.discoverable", true).or(clauses).order("created_at", { ascending: false }).limit(20),
      ]);
      if (p.error || s.error) setError((p.error ?? s.error)!.message);
      setPeople((p.data ?? []) as Person[]);
      setPosts((s.data ?? []) as unknown as Hit[]);
      setBusy(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, supabase]);

  const enc = encodeURIComponent(q.trim());
  const tabBtn = (t: typeof tab, label: string, n: number) => <button key={t} onClick={() => setTab(t)} className={`h-11 flex-1 rounded-full text-sm font-medium ${tab === t ? `${BRAND} text-white shadow` : "text-slate-500"}`}>{label} ({n})</button>;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-3 py-4 pb-24">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={() => router.back()} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-slate-100"><ArrowLeft className="h-6 w-6" /></button>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" aria-hidden="true" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, posts or #tags" className="h-12 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-base text-slate-900 outline-none focus:border-violet-400" />
        </div>
      </div>
      <div className="mb-4 flex gap-1 rounded-full bg-slate-100/60 p-1">{tabBtn("people", "People", people.length)}{tabBtn("posts", "Posts", posts.length)}</div>
      {error ? <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {busy ? <p className="py-6 text-center text-slate-500">Searching...</p> : null}

      {tab === "people" ? (
        <div className="space-y-2">
          {people.map((p) => (
            <Link key={p.id} href={`/${p.username}`} className="home-feed-card flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3">
              <Avatar p={p} size="h-12 w-12" />
              <span className="min-w-0"><span className="block truncate font-semibold">{p.name || p.username}</span><span className="block truncate text-sm text-slate-500">@{p.username}{p.bio ? ` · ${p.bio}` : ""}</span></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((h) => {
            const m = mediaOf(h)[0];
            return (
              <Link key={h.id} href={`/p/${h.id}`} className="home-feed-card flex gap-3 rounded-2xl border border-slate-200/80 bg-white p-3">
                {m?.type === "image" ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : null}
                <span className="min-w-0"><span className="block truncate font-semibold">{h.title || h.body.slice(0, 60) || "Post"}</span><span className="line-clamp-2 text-sm text-slate-500">{h.body}</span><span className="text-xs text-slate-400">@{h.profiles.username}</span></span>
              </Link>
            );
          })}
        </div>
      )}

      {q.trim().length >= 2 && !busy && ((tab === "people" && !people.length) || (tab === "posts" && !posts.length)) ? <p className="py-8 text-center text-slate-500">Nothing found on Maestra Vibe.</p> : null}

      {q.trim().length >= 2 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-4">
          <p className="mb-2 text-sm font-medium">Search elsewhere</p>
          <div className="flex flex-wrap gap-2">
            {ELSEWHERE.map((s) => <a key={s.name} href={s.href(enc)} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm text-slate-700 hover:bg-slate-50">{s.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></a>)}
          </div>
        </div>
      ) : null}
    </main>
  );
}