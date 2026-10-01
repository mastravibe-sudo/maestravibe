"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DbFeed from "@/components/DbFeed";
import { useColorMode } from "@/lib/theme";
import GetAppButton from "@/components/GetAppButton";

type ProfileSummary = { id: string; username: string; name: string | null; bio: string | null; avatar_url: string | null };

function Avatar({ person, size = "h-12 w-12" }: { person: ProfileSummary; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-800 font-semibold text-zinc-200`}>
      {person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" /> : (person.name || person.username).slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function HomeDashboard() {
  const { mode, toggleMode } = useColorMode();
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [following, setFollowing] = useState<ProfileSummary[]>([]);
  const [discover, setDiscover] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCommunity = useCallback(async () => {
    setError(null);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError && authError.name !== "AuthSessionMissingError") setError(authError.message);
    setUserId(user?.id ?? null);

    if (!user) {
      setProfile(null);
      setFollowing([]);
      setDiscover([]);
      setLoading(false);
      return;
    }

    const [profileResult, followsResult, peopleResult] = await Promise.all([
      supabase.from("profiles").select("id,username,name,bio,avatar_url").eq("id", user.id).maybeSingle(),
      supabase.from("follows").select("followed_id").eq("follower_id", user.id),
      supabase.from("profiles").select("id,username,name,bio,avatar_url").neq("id", user.id).order("created_at", { ascending: false }).limit(16),
    ]);

    if (profileResult.error) setError(profileResult.error.message);
    setProfile((profileResult.data as ProfileSummary | null) ?? null);
    if (followsResult.error) setError(followsResult.error.message);
    if (peopleResult.error) setError(peopleResult.error.message);

    const profiles = (peopleResult.data ?? []) as ProfileSummary[];
    const followedIds = new Set((followsResult.data ?? []).map((row) => row.followed_id as string));
    setFollowing(profiles.filter((person) => followedIds.has(person.id)));
    setDiscover(profiles.filter((person) => !followedIds.has(person.id)).slice(0, 5));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCommunity();
  }, [loadCommunity]);

  const follow = async (person: ProfileSummary) => {
    if (!userId) return;
    setBusyId(person.id);
    const { error: followError } = await supabase.from("follows").insert({ follower_id: userId, followed_id: person.id });
    if (followError) setError(followError.message);
    else await loadCommunity();
    setBusyId(null);
  };

  const profileCompletion = profile ? Math.round(([profile.name, profile.bio, profile.avatar_url].filter(Boolean).length / 3) * 100) : 0;

  return (
    <main data-mode={mode} className="home-dashboard-root mx-auto min-h-screen max-w-6xl px-3 py-5 pb-24 text-slate-900 sm:px-5 sm:py-7">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-700">Your community</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">{profile?.name ? `Welcome back, ${profile.name}` : "Home"}</h1>
          <p className="mt-1 text-sm text-slate-500">Updates from real people in your circle.</p>
        </div>
        <div className="flex items-center gap-2">
          <GetAppButton />
          <button onClick={toggleMode} aria-label={`Switch to ${mode === "light" ? "dark" : "light"} mode`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            {mode === "light" ? "◐ Dark mode" : "☀ Light mode"}
          </button>
          {profile ? <Link href={`/${profile.username}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">View profile</Link> : null}
        </div>
      </header>

      {error ? <p role="alert" className="mb-4 rounded-lg border border-amber-400/20 bg-amber-950/30 p-3 text-sm text-amber-100">{error}</p> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <section className="home-dashboard-panel mb-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Your circle</h2>
                <p className="mt-0.5 text-xs text-slate-500">People you follow</p>
              </div>
              {following.length ? <Link href="/friends" className="text-xs font-medium text-blue-700 hover:text-blue-600">See friends</Link> : null}
            </div>

            {loading ? <p className="py-5 text-sm text-zinc-500">Loading your circle...</p> : (
              <div className="flex gap-4 overflow-x-auto pb-1">
                {profile ? (
                  <Link href={`/${profile.username}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center">
                    <span className="rounded-full border border-dashed border-blue-400 p-0.5"><Avatar person={profile} /></span>
                    <span className="w-full truncate text-[11px] text-slate-500">You</span>
                  </Link>
                ) : null}
                {following.map((person) => (
                  <Link key={person.id} href={`/${person.username}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center">
                    <span className="rounded-full bg-linear-to-br from-blue-600 to-cyan-400 p-0.5"><Avatar person={person} /></span>
                    <span className="w-full truncate text-[11px] text-slate-500">{person.name || person.username}</span>
                  </Link>
                ))}
                {!profile && !following.length ? <Link href="/login" className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600">Log in to build your circle</Link> : null}
                {profile && !following.length ? <Link href="/friends" className="flex min-h-20 min-w-48 items-center rounded-lg border border-dashed border-slate-200 px-4 text-xs text-slate-500">Follow people to see their updates here.</Link> : null}
              </div>
            )}
          </section>

          <DbFeed />
        </div>

        <aside className="space-y-4">
          {profile ? (
            <section className="home-dashboard-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <Link href={`/${profile.username}`}><Avatar person={profile} size="h-11 w-11" /></Link>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{profile.name || profile.username}</p><p className="truncate text-xs text-slate-500">@{profile.username}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs"><span className="text-slate-500">Profile completion</span><span className="font-medium text-blue-700">{profileCompletion}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${profileCompletion}%` }} /></div>
              <Link href={`/${profile.username}?edit=1`} className="mt-4 block rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-medium text-slate-700 hover:bg-slate-200">Edit profile</Link>
            </section>
          ) : !loading ? (
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Join your community</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">Create a profile to follow people and share updates.</p>
              <Link href="/login" className="mt-4 block rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-blue-500">Log in or sign up</Link>
            </section>
          ) : null}

          <section className="home-dashboard-panel rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-slate-900">Discover people</h2><Link href="/friends" className="text-xs text-blue-700">Friends</Link></div>
            {loading ? <p className="text-xs text-slate-500">Finding people...</p> : discover.length ? (
              <div className="space-y-3">
                {discover.map((person) => (
                  <div key={person.id} className="flex min-w-0 items-center gap-2">
                    <Link href={`/${person.username}`}><Avatar person={person} size="h-9 w-9" /></Link>
                    <Link href={`/${person.username}`} className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-slate-800">{person.name || person.username}</p><p className="truncate text-[10px] text-slate-500">@{person.username}</p></Link>
                    {userId ? <button disabled={busyId === person.id} onClick={() => void follow(person)} className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-600 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50">{busyId === person.id ? "..." : "Follow"}</button> : null}
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-500">No new profiles to show yet.</p>}
          </section>

          <nav aria-label="Explore" className="grid grid-cols-2 gap-2 text-xs">
            <Link href="/notifications" className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-slate-700 shadow-sm hover:bg-slate-50">🔔 Notifications</Link>
            <Link href="/market" className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-slate-700 shadow-sm hover:bg-slate-50">🛍 Market</Link>
          </nav>
        </aside>
      </div>
    </main>
  );
}