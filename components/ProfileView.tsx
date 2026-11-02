"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRecord } from "@/lib/profile-schema";
import { requestActivityPush } from "@/lib/notifications/client";
import ProfileCanvas from "@/components/ProfileCanvas";
import ProfilePostGrid from "@/components/ProfilePostGrid";

export default function ProfileView({
  profile,
  access,
  stats,
  isFollowing: initialFollowing,
}: {
  profile: ProfileRecord;
  access: { isOwner: boolean; canView: boolean; viewerId: string | null };
  stats: { followers: number; following: number };
  isFollowing: boolean;
}) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(stats.followers);
  const [followError, setFollowError] = useState<string | null>(null);
  const theme = profile.theme;

  useEffect(() => {
    if (!access.viewerId || access.isOwner || !access.canView) return;
    void fetch("/api/notifications/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "profile_view", profileId: profile.id }),
    }).then((response) => {
      if (!response.ok) console.error("Profile visit notification failed.", response.status);
    }).catch(() => {
      console.error("Profile visit notification request failed.");
    });
  }, [access.canView, access.isOwner, access.viewerId, profile.id]);

  const handleFollowToggle = async () => {
    if (!access.viewerId || access.isOwner) return;
    setFollowError(null);
    const supabase = createClient();
    if (isFollowing) {
      const { error } = await supabase.from("follows").delete().eq("follower_id", access.viewerId).eq("followed_id", profile.id);
      if (error) return setFollowError(error.message);
      setIsFollowing(false);
      setFollowerCount((count) => Math.max(count - 1, 0));
      return;
    }

    const { error } = await supabase.from("follows").insert({ follower_id: access.viewerId, followed_id: profile.id });
    if (error) return setFollowError(error.message);
    setIsFollowing(true);
    setFollowerCount((count) => count + 1);
    const pushError = await requestActivityPush({ type: "follow", profileId: profile.id });
    if (pushError) setFollowError(pushError);
  };

  const goToPage = (page: number) => {
    const element = pagesRef.current;
    if (!element) return;
    element.scrollTo({ left: page * element.clientWidth, behavior: "smooth" });
    setActivePage(page);
  };

  if (!access.canView) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center px-4 py-10" style={{ background: theme.backgroundValue || theme.page, color: theme.text, fontFamily: theme.fontBody }}>
        <div className="max-w-lg border border-white/10 bg-black/30 p-8 text-center shadow-2xl backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-violet-200">Private profile</p>
          <h1 className="mt-4 text-3xl font-bold">This profile is private.</h1>
          <p className="mt-3 text-sm opacity-70">Follow this creator or log in to request access.</p>
        </div>
      </main>
    );
  }

  const editHref = `/${profile.username}?edit=1`;
  const action = access.isOwner ? (
    <Link href={editHref} className="inline-flex min-h-11 items-center rounded-full px-5 text-sm font-semibold shadow-lg" style={{ color: theme.buttonText, background: theme.accent }}>
      Edit profile
    </Link>
  ) : access.viewerId ? (
    <button onClick={() => void handleFollowToggle()} className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
      {isFollowing ? "Following" : "Follow"}
    </button>
  ) : (
    <Link href="/login" className="inline-flex min-h-11 items-center rounded-full border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
      Log in to follow
    </Link>
  );

  return (
    <main className="relative h-dvh w-screen overflow-hidden bg-[#07061a]">
      <div
        ref={pagesRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          setActivePage(Math.round(element.scrollLeft / element.clientWidth));
        }}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth"
        aria-label={`${profile.name || profile.username}'s profile pages`}
      >
        <section id="profile-page" aria-label="Profile" className="h-full w-screen shrink-0 snap-start overflow-y-auto overscroll-y-contain bg-[#07061a]">
          <div className="mx-auto w-full max-w-6xl px-3 py-5 pb-20 sm:px-6 sm:py-8">
            {followError ? <p role="alert" className="mb-3 rounded-lg border border-red-400/20 bg-red-950/30 p-3 text-sm text-red-200">{followError}</p> : null}
            <ProfileCanvas
              profile={profile}
              blocks={profile.blocks}
              stats={{ followers: followerCount, following: stats.following }}
              action={action}
            />
          </div>
        </section>

        <section id="posts-page" aria-label="Posts" className="h-full w-screen shrink-0 snap-start overflow-y-auto overscroll-y-contain bg-[#07061a] pb-20 text-white">
          <div className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-white/10 bg-[#07061a]/95 px-3 backdrop-blur sm:px-6">
            <button onClick={() => goToPage(0)} className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-white/85 hover:bg-white/10">
              <ArrowLeft className="h-4 w-4" /> Profile
            </button>
            <h1 className="text-sm font-semibold">Posts</h1>
            <span className="w-[76px]" aria-hidden="true" />
          </div>
          <ProfilePostGrid profile={profile} viewerId={access.viewerId} />
        </section>
      </div>

      <nav aria-label="Profile pages" className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#100d20]/90 px-4 py-2 shadow-xl backdrop-blur">
        <button onClick={() => goToPage(0)} aria-label="Show profile page" aria-current={activePage === 0 ? "page" : undefined} className={`h-3 w-3 rounded-full transition ${activePage === 0 ? "scale-125 bg-violet-300" : "bg-white/35 hover:bg-white/70"}`} />
        <button onClick={() => goToPage(1)} aria-label="Show posts page" aria-current={activePage === 1 ? "page" : undefined} className={`h-3 w-3 rounded-full transition ${activePage === 1 ? "scale-125 bg-violet-300" : "bg-white/35 hover:bg-white/70"}`} />
        <button onClick={() => goToPage(activePage === 0 ? 1 : 0)} aria-label={activePage === 0 ? "Go to posts" : "Back to profile"} className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
          {activePage === 0 ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        </button>
      </nav>
    </main>
  );
}
