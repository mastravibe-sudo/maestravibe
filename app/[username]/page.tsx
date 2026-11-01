import { notFound } from "next/navigation";
import ProfileBuilder from "@/components/ProfileBuilder";
import ProfileView from "@/components/ProfileView";
import { createClient } from "@/lib/supabase/server";
import { profileRecordSchema } from "@/lib/profile-schema";

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
    <ProfileView
      profile={profile}
      access={{ isOwner, canView, viewerId }}
      stats={{ followers: followerCount ?? 0, following: followingCount ?? 0 }}
      isFollowing={!!followCheck.data}
    />
  );
}
