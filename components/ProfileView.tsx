"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRecord } from "@/lib/profile-schema";
import ProfileCanvas from "@/components/ProfileCanvas";

function getAccessibleBlocks(profile: ProfileRecord, isOwner: boolean, isFollowing: boolean) {
  return [...profile.blocks]
    .filter((block) => {
      if (block.style.hidden === true) return false;
      if (isOwner) return true;
      if (block.visibility === "only_me") return false;
      if (block.visibility === "followers") return isFollowing;
      return true;
    })
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

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
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followerCount, setFollowerCount] = useState(stats.followers);
  const [followError, setFollowError] = useState<string | null>(null);
  const theme = profile.theme;
  const visibleBlocks = getAccessibleBlocks(profile, access.isOwner, isFollowing);

  const handleFollowToggle = async () => {
    if (!access.viewerId || access.isOwner) return;
    setFollowError(null);
    const supabase = createClient();
    if (isFollowing) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", access.viewerId)
        .eq("followed_id", profile.id);
      if (error) return setFollowError(error.message);
      setIsFollowing(false);
      setFollowerCount((count) => Math.max(count - 1, 0));
      return;
    }

    const { error } = await supabase
      .from("follows")
      .insert({ follower_id: access.viewerId, followed_id: profile.id });
    if (error) return setFollowError(error.message);
    setIsFollowing(true);
    setFollowerCount((count) => count + 1);
  };

  if (!access.canView) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10" style={{ background: theme.backgroundValue || theme.page, color: theme.text, fontFamily: theme.fontBody }}>
        <div className="max-w-lg border border-white/10 bg-black/30 p-8 text-center shadow-2xl backdrop-blur-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-violet-200">Private profile</p>
          <h1 className="mt-4 text-3xl font-bold">This profile is private.</h1>
          <p className="mt-3 text-sm opacity-70">Follow this creator or log in to request access.</p>
        </div>
      </main>
    );
  }

  const followAction = access.isOwner ? (
    <Link href={`/${profile.username}?edit=1`} className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold" style={{ color: theme.buttonText, background: theme.accent, borderRadius: `${theme.radius}px` }}>
      Edit profile
    </Link>
  ) : (
    access.viewerId ? (
      <button
        onClick={handleFollowToggle}
        className="shrink-0 px-4 py-2 text-sm font-semibold transition hover:brightness-110"
        style={{
          borderRadius: `${theme.radius}px`,
          color: theme.buttonStyle === "filled" ? theme.buttonText : theme.accent,
          background: theme.buttonStyle === "filled" ? theme.accent : "transparent",
          border: theme.buttonStyle === "ghost" ? "1px solid transparent" : `1px solid ${theme.accent}`,
        }}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    ) : (
      <Link href="/login" className="shrink-0 px-4 py-2 text-sm font-semibold" style={{ color: theme.accent, border: `1px solid ${theme.accent}`, borderRadius: `${theme.radius}px` }}>
        Log in to follow
      </Link>
    )
  );

  return (
    <main className="min-h-screen px-3 py-5 sm:px-6 sm:py-8" style={{ background: theme.page, color: theme.text, fontFamily: theme.fontBody }}>
      {followError ? <p role="alert" className="mx-auto mb-3 max-w-5xl text-sm text-red-300">{followError}</p> : null}
      <ProfileCanvas profile={profile} blocks={visibleBlocks} stats={{ followers: followerCount, following: stats.following }} action={followAction} />
    </main>
  );
}
