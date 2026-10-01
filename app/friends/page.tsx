"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; username: string; name: string | null; avatar_url: string | null };
type FriendTab = "following" | "followers";

export default function FriendsPage() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState<Person[]>([]);
  const [followers, setFollowers] = useState<Person[]>([]);
  const [tab, setTab] = useState<FriendTab>("following");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) {
      setFollowing([]);
      setFollowers([]);
      setLoading(false);
      return;
    }

    const [followingResult, followersResult] = await Promise.all([
      supabase.from("follows").select("followed_id").eq("follower_id", user.id),
      supabase.from("follows").select("follower_id").eq("followed_id", user.id),
    ]);
    if (followingResult.error || followersResult.error) {
      setError(followingResult.error?.message ?? followersResult.error?.message ?? "Could not load friends.");
      setLoading(false);
      return;
    }

    const followingIds = (followingResult.data ?? []).map((row) => row.followed_id);
    const followerIds = (followersResult.data ?? []).map((row) => row.follower_id);
    const allIds = [...new Set([...followingIds, ...followerIds])];
    const { data: people, error: peopleError } = allIds.length
      ? await supabase.from("profiles").select("id,username,name,avatar_url").in("id", allIds)
      : { data: [], error: null };
    if (peopleError) setError(peopleError.message);
    const byId = new Map(((people ?? []) as Person[]).map((person) => [person.id, person]));
    setFollowing(followingIds.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []));
    setFollowers(followerIds.flatMap((id) => byId.has(id) ? [byId.get(id)!] : []));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const toggleFollow = async (person: Person, currentlyFollowing: boolean) => {
    if (!userId) return;
    setBusyId(person.id);
    setError(null);
    const result = currentlyFollowing
      ? await supabase.from("follows").delete().eq("follower_id", userId).eq("followed_id", person.id)
      : await supabase.from("follows").insert({ follower_id: userId, followed_id: person.id });
    if (result.error) setError(result.error.message);
    else await load();
    setBusyId(null);
  };

  const current = tab === "following" ? following : followers;
  const filtered = current.filter((person) => `${person.name ?? ""} ${person.username}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-8 pb-24 text-zinc-100 md:px-8">
      <header className="mb-7 border-b border-white/10 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Your community</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Friends</h1>
        <p className="mt-2 text-sm text-zinc-400">People you follow and people following you.</p>
      </header>

      {!userId && !loading ? (
        <Link href="/login" className="block border border-white/10 bg-zinc-900 p-5 text-center text-sm text-zinc-300">Log in to see your friends</Link>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-white/10 bg-zinc-900 p-1">
              {(["following", "followers"] as FriendTab[]).map((item) => (
                <button key={item} onClick={() => setTab(item)} className={`rounded-md px-4 py-2 text-sm capitalize ${tab === item ? "bg-violet-500 text-white" : "text-zinc-400 hover:text-white"}`}>
                  {item} <span className="ml-1 opacity-70">{item === "following" ? following.length : followers.length}</span>
                </button>
              ))}
            </div>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
          </div>

          {error ? <p role="alert" className="mb-4 border border-red-400/20 bg-red-950/40 p-3 text-sm text-red-200">{error}</p> : null}
          {loading ? <p className="py-12 text-center text-sm text-zinc-500">Loading friends...</p> : filtered.length ? (
            <div className="divide-y divide-white/10 border-y border-white/10">
              {filtered.map((person) => {
                const isFollowing = following.some((item) => item.id === person.id);
                return (
                  <article key={person.id} className="flex items-center gap-3 py-4">
                    <Link href={`/${person.username}`} className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-lg font-semibold text-white">
                      {person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" /> : (person.name || person.username).slice(0, 1).toUpperCase()}
                    </Link>
                    <Link href={`/${person.username}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{person.name || person.username}</p>
                      <p className="truncate text-xs text-zinc-500">@{person.username}</p>
                    </Link>
                    {person.id !== userId ? (
                      <button disabled={busyId === person.id} onClick={() => void toggleFollow(person, isFollowing)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-50 ${isFollowing ? "border border-white/10 text-zinc-300" : "bg-violet-500 text-white"}`}>
                        {busyId === person.id ? "..." : isFollowing ? "Following" : "Follow back"}
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : <p className="py-12 text-center text-sm text-zinc-500">{search ? "No people match your search." : `No ${tab} yet.`}</p>}
        </>
      )}
    </main>
  );
}
