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
  const { username } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRow, error } = await supabase
    .from("profiles")
    .select("*, profile_blocks!profile_blocks_profile_id_fkey(*)")
    .eq("username", username)
    .maybeSingle();

  if (error || !profileRow) {
    notFound();
  }

  const profile = profileRecordSchema.parse({
    ...profileRow,
    blocks: Array.isArray(profileRow.profile_blocks) ? profileRow.profile_blocks : [],
  });

  const viewerId = user?.id ?? null;
  const isOwner = !!viewerId && viewerId === profile.id;
  const followCheck = viewerId
    ? await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", viewerId)
        .eq("followed_id", profile.id)
        .maybeSingle()
    : { data: null };

  const { count: followerCount } = await supabase
    .from("follows")
    .select("follower_id", { count: "exact" })
    .eq("followed_id", profile.id);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("followed_id", { count: "exact" })
    .eq("follower_id", profile.id);

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
