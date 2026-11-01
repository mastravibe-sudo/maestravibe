"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Camera, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { ProfileRecord } from "@/lib/profile-schema";
import { STICKERS } from "@/lib/stickers";
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
  const background = profile.banner_url
    ? `url("${profile.banner_url}")`
    : theme.backgroundType === "gradient"
      ? theme.backgroundValue
      : theme.page;

  return (
    <main className="min-h-screen w-full overflow-x-hidden" style={{ background: theme.page, color: theme.text, fontFamily: theme.fontBody }}>
      <section className="relative min-h-[360px] w-full overflow-hidden sm:min-h-[420px]" style={{ backgroundImage: background, backgroundColor: theme.page, backgroundPosition: "center", backgroundSize: "cover" }}>
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/25" />
        {(theme.stickers ?? []).map((sticker) => {
          const localSticker = sticker.type === "svg" ? STICKERS.find((item) => item.id === sticker.value) : null;
          if (sticker.type === "svg" && !localSticker) return null;
          return (
            <div
              key={sticker.id}
              aria-hidden="true"
              className="pointer-events-none absolute z-[1] flex aspect-square items-center justify-center"
              style={{
                left: `${sticker.x}%`,
                top: `${sticker.y}%`,
                width: `${sticker.size}%`,
                transform: `rotate(${sticker.rotation}deg)`,
                fontSize: `clamp(2rem, ${sticker.size * 0.75}vw, 5rem)`,
              }}
            >
              {sticker.type === "emoji" ? sticker.value : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={localSticker?.src ?? ""} alt="" className="h-full w-full object-contain" />
              )}
            </div>
          );
        })}
        {access.isOwner ? (
          <Link href={editHref} aria-label="Edit cover image" className="absolute right-4 top-4 z-10 inline-flex h-10 items-center gap-2 rounded-full border border-white/25 bg-black/45 px-4 text-sm font-medium text-white backdrop-blur hover:bg-black/65">
            <ImagePlus className="h-4 w-4" /> Edit cover
          </Link>
        ) : null}

        <div className="relative z-[1] mx-auto flex min-h-[360px] w-full max-w-7xl items-end px-5 pb-7 pt-20 sm:min-h-[420px] sm:px-8 sm:pb-9">
          <div className="flex w-full flex-col items-start gap-5 sm:flex-row sm:items-end sm:gap-6">
            <div className="relative shrink-0">
              <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white/90 bg-zinc-800 text-4xl font-bold text-white shadow-xl sm:h-36 sm:w-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile.name || profile.username).slice(0, 1).toUpperCase()}
              </span>
              {access.isOwner ? (
                <Link href={editHref} aria-label="Edit profile photo" className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-violet-600 text-white shadow-lg hover:bg-violet-500">
                  <Camera className="h-5 w-5" />
                </Link>
              ) : null}
            </div>

            <div className="min-w-0 flex-1 text-white">
              <h1 className="break-words text-3xl font-bold tracking-tight drop-shadow sm:text-4xl">{profile.name || profile.username}</h1>
              <p className="mt-1 text-sm text-white/75">@{profile.username}</p>
              {profile.bio ? <p className="mt-3 max-w-2xl whitespace-pre-wrap text-sm leading-relaxed text-white/90 sm:text-base">{profile.bio}</p> : null}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/85">
                <span><strong className="text-white">{followerCount}</strong> followers</span>
                <span><strong className="text-white">{stats.following}</strong> following</span>
              </div>
            </div>

            <div className="shrink-0 pb-1">
              {access.isOwner ? (
                <Link href={editHref} className="inline-flex h-11 items-center rounded-full px-5 text-sm font-semibold shadow-lg" style={{ color: theme.buttonText, background: theme.accent }}>
                  Edit profile
                </Link>
              ) : access.viewerId ? (
                <button onClick={handleFollowToggle} className="inline-flex h-11 items-center rounded-full border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
                  {isFollowing ? "Following" : "Follow"}
                </button>
              ) : (
                <Link href="/login" className="inline-flex h-11 items-center rounded-full border border-white/40 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur hover:bg-white/20">
                  Log in to follow
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8">
        {followError ? <p role="alert" className="mb-4 text-sm text-red-400">{followError}</p> : null}
        <ProfilePostGrid profile={profile} viewerId={access.viewerId} />
      </div>
    </main>
  );
}
