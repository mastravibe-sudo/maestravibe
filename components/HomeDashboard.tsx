// path: maestra-vibe/components/HomeDashboard.tsx  (poori file replace karo)
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Bell, Search, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/components/CurrentUserContext";
import DbFeed from "@/components/DbFeed";
import GetAppButton from "@/components/GetAppButton";
import { requestActivityPush } from "@/lib/notifications/client";

type ProfileSummary = { id: string; username: string; name: string | null; bio: string | null; avatar_url: string | null };

const panel = "rounded-xl border border-white/[0.06] bg-[#141028] p-3";
const toolBtn = "inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#1d1840] text-[#e4e0ff] hover:bg-[#25205a]";

function Avatar({ person, size = "h-12 w-12" }: { person: ProfileSummary; size?: string }) {
  return (
    <span className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-800 font-semibold text-zinc-200`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {person.avatar_url ? <img src={person.avatar_url} alt="" loading="lazy" className="h-full w-full object-cover" /> : (person.name || person.username).slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function HomeDashboard() {
  const [supabase] = useState(() => createClient());
  const { userId, profile, ready } = useCurrentUser();
  const [following, setFollowing] = useState<ProfileSummary[]>([]);
  const [discover, setDiscover] = useState<ProfileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadCommunity = useCallback(async () => {
    if (!ready) return;
    setError(null);
    if (!userId) {
      setFollowing([]);
      setDiscover([]);
      setLoading(false);
      return;
    }

    const [followsResult, peopleResult] = await Promise.all([
      supabase.from("follows").select("followed_id").eq("follower_id", userId),
      supabase.from("profiles").select("id,username,name,bio,avatar_url").neq("id", userId).order("created_at", { ascending: false }).limit(16),
    ]);

    if (followsResult.error) setError(followsResult.error.message);
    if (peopleResult.error) setError(peopleResult.error.message);

    const profiles = (peopleResult.data ?? []) as ProfileSummary[];
    const followedIds = new Set((followsResult.data ?? []).map((row) => row.followed_id as string));
    setFollowing(profiles.filter((person) => followedIds.has(person.id)));
    setDiscover(profiles.filter((person) => !followedIds.has(person.id)).slice(0, 5));
    setLoading(false);
  }, [ready, supabase, userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadCommunity();
  }, [loadCommunity]);

  const follow = async (person: ProfileSummary) => {
    if (!userId) return;
    setBusyId(person.id);
    const { error: followError } = await supabase.from("follows").insert({ follower_id: userId, followed_id: person.id });
    if (followError) setError(followError.message);
    else {
      const pushError = await requestActivityPush({ type: "follow", profileId: person.id });
      if (pushError) setError(pushError);
      await loadCommunity();
    }
    setBusyId(null);
  };

  const profileCompletion = profile ? Math.round(([profile.name, profile.bio, profile.avatar_url].filter(Boolean).length / 3) * 100) : 0;
  const followBtn = (person: ProfileSummary) =>
    userId ? (
      <button disabled={busyId === person.id} onClick={() => void follow(person)} className="min-h-10 shrink-0 rounded-md border border-white/10 px-3 text-xs font-medium text-[#c9c4e8] hover:border-fuchsia-300 hover:text-violet-200 disabled:opacity-50">
        {busyId === person.id ? "..." : "Follow"}
      </button>
    ) : null;

  const circleCard = (
    <section className={`${panel} rounded-xl border-white/[0.06] p-3`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div><h2 className="text-sm font-semibold text-[#f4f2ff]">Your circle</h2><p className="mt-0.5 text-xs text-[#a8a2c9]">People you follow</p></div>
        {following.length ? <Link href="/friends" className="text-xs font-medium text-violet-300 hover:text-violet-200">See friends</Link> : null}
      </div>
      {loading ? <p className="py-4 text-sm text-zinc-500">Loading your circle...</p> : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {profile ? <Link href={`/${profile.username}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"><span className="rounded-full border border-dashed border-fuchsia-400 p-0.5"><Avatar person={profile} /></span><span className="w-full truncate text-[11px] text-[#a8a2c9]">You</span></Link> : null}
          {following.map((person) => <Link key={person.id} href={`/${person.username}`} className="flex w-16 shrink-0 flex-col items-center gap-1.5 text-center"><span className="rounded-full bg-linear-to-br from-violet-500 via-fuchsia-500 to-blue-500 p-0.5"><Avatar person={person} /></span><span className="w-full truncate text-[11px] text-[#a8a2c9]">{person.name || person.username}</span></Link>)}
          {!profile && !following.length ? <Link href="/login" className="rounded-lg border border-white/10 px-3 py-2 text-sm text-[#c9c4e8]">Log in to build your circle</Link> : null}
          {profile && !following.length ? <Link href="/friends" className="flex min-h-16 min-w-48 items-center rounded-lg border border-dashed border-white/10 px-4 text-xs text-[#a8a2c9]">Follow people to see their updates here.</Link> : null}
        </div>
      )}
    </section>
  );
  const discoverCard = (
    <section className={`${panel} rounded-xl border-white/[0.06] p-3`}>
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-[#f4f2ff]">Discover people</h2><Link href="/friends" className="text-xs text-violet-300">Explore</Link></div>
      {loading ? <p className="text-xs text-[#a8a2c9]">Finding people...</p> : discover.length ? (
        <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible">
          {discover.map((person) => (
            <div key={person.id} className="flex w-36 shrink-0 flex-col items-center gap-2 rounded-lg border border-white/[0.06] p-3 text-center sm:w-auto">
              <Link href={`/${person.username}`}><Avatar person={person} size="h-11 w-11" /></Link>
              <Link href={`/${person.username}`} className="w-full truncate text-xs font-medium text-[#f4f2ff]">{person.name || person.username}</Link>
              {followBtn(person)}
            </div>
          ))}
        </div>
      ) : <p className="text-xs text-[#a8a2c9]">No new profiles to show yet.</p>}
    </section>
  );

  return (
    <main data-mode="dark" className="mx-auto min-h-screen max-w-6xl px-3 py-5 pb-24 text-[#f4f2ff] sm:px-5 sm:py-7">
      <header className="mb-4 flex items-center gap-3">
        <Link href="/" className="flex flex-1 items-center gap-3 md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/maestravibe.png" alt="Maestra Vibe logo" className="h-11 w-11 rounded-xl object-cover" />
          <span className="text-xl font-bold">Maestra <span className="text-violet-300">Vibe</span></span>
        </Link>
        <h1 className="hidden flex-1 text-2xl font-bold md:block">{profile?.name ? `Welcome back, ${profile.name}` : "Home"}</h1>
        <Link href="/search" aria-label="Search" className={toolBtn}><Search className="h-5 w-5" aria-hidden="true" /></Link>
        <Link href="/notifications" aria-label="Notifications" className={toolBtn}><Bell className="h-5 w-5" aria-hidden="true" /></Link>
        <GetAppButton />
      </header>

      {error ? <p role="alert" className="mb-4 rounded-lg border border-amber-400/20 bg-amber-950/30 p-3 text-sm text-amber-100">{error}</p> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <DbFeed circleCard={circleCard} discoverCard={discoverCard} />
        </div>

        <aside className="hidden space-y-4 xl:sticky xl:top-6 xl:block">
          {profile ? (
            <section className={panel}>
              <div className="flex items-center gap-3">
                <Link href={`/${profile.username}`}><Avatar person={profile} size="h-11 w-11" /></Link>
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-[#f4f2ff]">{profile.name || profile.username}</p><p className="truncate text-xs text-[#a8a2c9]">@{profile.username}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs"><span className="text-[#a8a2c9]">Profile completion</span><span className="font-medium text-violet-600">{profileCompletion}%</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1d1840]"><div className="h-full rounded-full bg-linear-to-r from-violet-600 via-fuchsia-500 to-blue-500" style={{ width: `${profileCompletion}%` }} /></div>
              <Link href={`/${profile.username}?edit=1`} className="mt-4 block rounded-lg bg-[#1d1840] px-3 py-2 text-center text-xs font-medium text-[#e4e0ff] hover:bg-[#25205a]">Edit profile</Link>
            </section>
          ) : !loading ? (
            <section className={panel}>
              <h2 className="text-sm font-semibold text-[#f4f2ff]">Join your community</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#a8a2c9]">Create a profile to follow people and share updates.</p>
              <Link href="/login" className="mt-4 block rounded-lg bg-linear-to-r from-violet-600 via-fuchsia-500 to-blue-500 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-blue-500">Log in or sign up</Link>
            </section>
          ) : null}

          <nav aria-label="Explore" className="grid grid-cols-2 gap-2 text-xs">
            <Link href="/notifications" className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#141028] px-3 py-3 text-[#e4e0ff] shadow-sm hover:bg-[#141028]/5"><Bell className="h-4 w-4" aria-hidden="true" />Notifications</Link>
            <Link href="/market" className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#141028] px-3 py-3 text-[#e4e0ff] shadow-sm hover:bg-[#141028]/5"><ShoppingBag className="h-4 w-4" aria-hidden="true" />Maestra Market</Link>
          </nav>
        </aside>
      </div>
    </main>
  );
}