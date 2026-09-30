import { notFound } from "next/navigation";
import ProfileView from "@/components/ProfileView";
import { profiles } from "@/lib/profiles";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = profiles.find((p) => p.username === username);

  if (!profile) notFound();

  return <ProfileView initial={profile} />;
}