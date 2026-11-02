"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Bookmark, Flame, Play } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { mediaOf, type Orig, type Row } from "@/components/postUtils";
import type { ProfileRecord } from "@/lib/profile-schema";
import { requestActivityPush } from "@/lib/notifications/client";

const PostViewer = dynamic(() => import("@/components/PostViewer"), { loading: () => null });

const SELECT =
  "id,type,title,body,tags,location,media,image_url,created_at,user_id,comment_policy,comments_closed,share_policy,repost_of," +
  "profiles!posts_user_id_fkey(username,name,avatar_url,style),vibes(user_id,kind),saves(user_id)," +
  "comments(id,body,pinned,created_at,user_id,profiles!comments_user_id_fkey(username,name,avatar_url))";
const ORIG = "id,title,body,image_url,media,profiles!posts_user_id_fkey(username,name,avatar_url)";
type Tab = "Posts" | "Videos" | "Vibes";

export default function ProfilePostGrid({ profile, viewerId }: { profile: ProfileRecord; viewerId: string | null }) {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [tab, setTab] = useState<Tab>("Posts");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("posts")
      .select(SELECT)
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(60);
    if (queryError) {
      setError(queryError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const posts = (data ?? []) as unknown as Row[];
    const originalIds = [...new Set(posts.map((post) => post.repost_of).filter((id): id is string => !!id))];
    if (originalIds.length) {
      const { data: originals, error: originalError } = await supabase.from("posts").select(ORIG).in("id", originalIds);
      if (originalError) {
        setError(originalError.message);
        setRows([]);
        setLoading(false);
        return;
      }
      const originalMap = new Map(((originals ?? []) as unknown as Orig[]).map((original) => [original.id, original]));
      posts.forEach((post) => { post.original = post.repost_of ? originalMap.get(post.repost_of) ?? null : null; });
    }
    setRows(posts);
    setError(null);
    setLoading(false);
  }, [profile.id, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = rows.filter((row) => {
    const media = mediaOf(row.original ?? row)[0];
    if (tab === "Videos") return media?.type === "video";
    if (tab === "Vibes") return row.type === "vibe";
    return true;
  });

  const react = async (kind: "vibe" | "support" | "inspire") => {
    if (!selected || !viewerId) return;
    const current = selected.vibes.find((vibe) => vibe.user_id === viewerId);
    if (current) {
      const { error: removeError } = await supabase.from("vibes").delete().eq("post_id", selected.id).eq("user_id", viewerId);
      if (removeError) return setError(removeError.message);
    }
    if (!current || (current.kind ?? "vibe") !== kind) {
      const { error: insertError } = await supabase.from("vibes").insert({ post_id: selected.id, user_id: viewerId, kind });
      if (insertError) return setError(insertError.message);
      const pushError = await requestActivityPush({ type: "vibe", postId: selected.id });
      if (pushError) setError(pushError);
    }
    await load();
  };
  const save = async () => {
    if (!selected || !viewerId) return;
    const saved = selected.saves.some((entry) => entry.user_id === viewerId);
    const { error: saveError } = saved
      ? await supabase.from("saves").delete().eq("post_id", selected.id).eq("user_id", viewerId)
      : await supabase.from("saves").insert({ post_id: selected.id, user_id: viewerId });
    if (saveError) return setError(saveError.message);
    await load();
  };
  const repost = async () => {
    if (!selected || !viewerId) return;
    const { error: repostError } = await supabase.from("posts").insert({ user_id: viewerId, type: selected.type, body: "", repost_of: selected.repost_of ?? selected.id });
    if (repostError) setError(repostError.message);
  };
  const share = async () => {
    if (!selected) return;
    const url = `${window.location.origin}/p/${selected.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: selected.title || "Maestra Vibe", url }); return; } catch { /* user cancelled */ }
    }
    await navigator.clipboard?.writeText(url);
  };
  const comment = async (body: string) => {
    if (!selected || !viewerId) return;
    const { error: commentError } = await supabase.from("comments").insert({ post_id: selected.id, user_id: viewerId, body });
    if (commentError) return setError(commentError.message);
    const pushError = await requestActivityPush({ type: "comment", postId: selected.id });
    if (pushError) setError(pushError);
    await load();
  };
  const report = async (reason: string) => {
    if (!selected || !viewerId) return;
    const { error: reportError } = await supabase.from("reports").insert({ reporter_id: viewerId, post_id: selected.id, reason: reason.slice(0, 300) });
    if (reportError) setError(reportError.message);
  };
  const hide = () => {
    if (!selected) return;
    const hiddenId = selected.id;
    setRows((current) => current.filter((row) => row.id !== hiddenId));
    try {
      const stored: unknown = JSON.parse(localStorage.getItem("mv-hidden") ?? "[]");
      const hidden = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
      localStorage.setItem("mv-hidden", JSON.stringify([...new Set([...hidden, hiddenId])]));
    } catch { /* Post is hidden for this view even if storage is unavailable. */ }
  };
  const toggleComments = async () => {
    if (!selected || selected.user_id !== viewerId) return;
    const { error: updateError } = await supabase.from("posts").update({ comment_policy: selected.comment_policy === "off" ? "everyone" : "off" }).eq("id", selected.id);
    if (updateError) setError(updateError.message);
    else await load();
  };
  const remove = async () => {
    if (!selected || selected.user_id !== viewerId) return;
    const { error: deleteError } = await supabase.from("posts").delete().eq("id", selected.id);
    if (deleteError) setError(deleteError.message);
    else {
      setSelected(null);
      await load();
    }
  };

  return (
    <section className="min-h-full w-full bg-[#07061a]">
      <div className="mb-4 flex border-b border-white/10 px-3 sm:px-6" role="tablist" aria-label="Profile posts">
        {(["Posts", "Videos", "Vibes"] as const).map((item) => (
          <button key={item} role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`min-h-12 flex-1 border-b-2 px-3 text-sm font-semibold transition ${tab === item ? "border-violet-400 text-white" : "border-transparent text-white/55 hover:text-white/80"}`}>
            {item}
          </button>
        ))}
      </div>

      {error ? <p role="alert" className="mb-4 rounded-lg border border-red-400/20 bg-red-950/30 p-3 text-sm text-red-200">{error}</p> : null}
      {loading ? <p className="py-12 text-center text-sm text-white/50">Loading posts...</p> : filtered.length ? (
        <div className="grid w-full grid-cols-3 gap-px bg-[#07061a]">
          {filtered.map((row) => {
            const shown = row.original ?? row;
            const media = mediaOf(shown)[0];
            return (
              <button key={row.id} onClick={() => setSelected(row)} aria-label={`Open ${media?.type === "video" ? "video" : "post"}`} className="group relative aspect-square overflow-hidden bg-[#10101a] text-left">
                {media?.type === "video" ? (
                  <>
                    <video src={media.url} poster={media.poster ?? media.thumbnail} muted playsInline preload="metadata" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    <Play className="absolute right-2 top-2 h-5 w-5 fill-white text-white drop-shadow" />
                  </>
                ) : media ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.url} alt={shown.title || shown.body.slice(0, 100)} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                ) : (
                  <span className="flex h-full flex-col justify-between bg-[#10101a] p-2 text-white sm:p-4">
                    <span className="line-clamp-5 text-xs font-medium leading-relaxed sm:text-sm">{shown.title || shown.body || "Vibe"}</span>
                    <span className="flex items-center gap-1 text-[10px] text-white/70"><Flame className="h-3 w-3" />{row.vibes.length}</span>
                  </span>
                )}
                {media ? <span className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-8 text-[10px] text-white sm:px-3 sm:text-xs">
                  <span className="line-clamp-2">{shown.title || shown.body}</span>
                  {row.saves.some((entry) => entry.user_id === viewerId) ? <Bookmark className="ml-1 h-4 w-4 shrink-0 fill-current" /> : null}
                </span> : null}
              </button>
            );
          })}
        </div>
      ) : <p className="py-16 text-center text-sm text-white/50">{tab === "Videos" ? "No videos yet." : tab === "Vibes" ? "No vibes yet." : "No posts yet."}</p>}

      {selected ? (
        <PostViewer
          row={selected}
          me={viewerId}
          onClose={() => setSelected(null)}
          onReact={(kind) => void react(kind)}
          onSave={() => void save()}
          onRepost={() => void repost()}
          onShare={() => void share()}
          onComment={(body) => void comment(body)}
          onReport={(reason) => void report(reason)}
          onHide={hide}
          onToggleComments={() => void toggleComments()}
          onDelete={() => void remove()}
        />
      ) : null}
    </section>
  );
}
