import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProfileBuilder from "@/components/ProfileBuilder";
import ProfileView from "@/components/ProfileView";
import { publicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { profileRecordSchema } from "@/lib/profile-schema";
import { SITE_URL } from "@/lib/site";

type PublicProfileSeo = {
  id: string;
  username: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  visibility: string;
  discoverable: boolean;
};

const getPublicProfileSeo = cache(async (username: string): Promise<PublicProfileSeo | null> => {
  const { data, error } = await publicClient()
    .from("profiles")
    .select("id,username,name,bio,avatar_url,visibility,discoverable")
    .eq("username", username)
    .maybeSingle();
  if (error) {
    console.error("Could not load public profile metadata.", error.message);
    return null;
  }
  return data as PublicProfileSeo | null;
});

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await getPublicProfileSeo(username);
  if (!profile || profile.visibility !== "public") {
    return { title: "Profile | Maestra Vibe", robots: { index: false, follow: false } };
  }

  const displayName = profile.name || `@${profile.username}`;
  const title = `${displayName} | Maestra Vibe`;
  const description = (profile.bio?.trim() || `Explore ${displayName}'s profile and posts on Maestra Vibe.`).slice(0, 160);
  const canonical = `${SITE_URL}/${profile.username}`;
  return {
    title,
    description,
    robots: { index: profile.discoverable, follow: true },
    alternates: { canonical },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      ...(profile.avatar_url ? { images: [{ url: profile.avatar_url, alt: `${displayName}'s profile photo` }] } : {}),
    },
    twitter: {
      card: profile.avatar_url ? "summary_large_image" : "summary",
      title,
      description,
      ...(profile.avatar_url ? { images: [profile.avatar_url] } : {}),
    },
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ username }, { edit }, supabase] = await Promise.all([params, searchParams, createClient()]);

  const [authResult, profileResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("id,username,name,bio,avatar_url,banner_url,template,theme,visibility,discoverable,verified,created_at,updated_at")
      .eq("username", username)
      .maybeSingle(),
  ]);
  const user = authResult.data.user;
  const { data: profileRow, error } = profileResult;

  if (error || !profileRow) {
    notFound();
  }

  const viewerId = user?.id ?? null;
  const isOwner = !!viewerId && viewerId === profileRow.id;
  const [followCheck, followerResult, followingResult, blocksResult] = await Promise.all([
    viewerId
      ? supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", viewerId)
        .eq("followed_id", profileRow.id)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("follows").select("follower_id", { count: "exact", head: true }).eq("followed_id", profileRow.id),
    supabase.from("follows").select("followed_id", { count: "exact", head: true }).eq("follower_id", profileRow.id),
    isOwner && edit === "1"
      ? supabase
          .from("profile_blocks")
          .select("id,profile_id,type,position,width,config,style,visibility,locked,created_at,updated_at")
          .eq("profile_id", profileRow.id)
          .order("position")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (blocksResult.error) notFound();
  const profile = profileRecordSchema.parse({
    ...profileRow,
    blocks: blocksResult.data ?? [],
  });
  const followerCount = followerResult.count;
  const followingCount = followingResult.count;

  const canView =
    isOwner ||
    profile.visibility === "public" ||
    (profile.visibility === "followers" && !!followCheck.data);

  if (isOwner && edit === "1") {
    return <ProfileBuilder profile={profile} stats={{ followers: followerCount ?? 0, following: followingCount ?? 0 }} />;
  }

  return (
    <>
      {profile.visibility === "public" ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Person",
              name: profile.name || profile.username,
              url: `${SITE_URL}/${profile.username}`,
              ...(profile.bio ? { description: profile.bio } : {}),
              ...(profile.avatar_url ? { image: profile.avatar_url } : {}),
              identifier: `@${profile.username}`,
            }).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}
      <ProfileView
        profile={profile}
        access={{ isOwner, canView, viewerId }}
        stats={{ followers: followerCount ?? 0, following: followingCount ?? 0 }}
        isFollowing={!!followCheck.data}
      />
    </>
  );
}
