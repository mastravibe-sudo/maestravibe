"use client";

import type { ProfileRecord } from "@/lib/profile-schema";
import dynamic from "next/dynamic";

const ProfileStudio = dynamic(() => import("@/components/ProfileStudio"), {
  loading: () => <div className="min-h-dvh animate-pulse bg-zinc-950" aria-label="Loading profile editor" />,
});

export default function ProfileBuilder({
  profile,
  stats,
}: {
  profile: ProfileRecord;
  stats: { followers: number; following: number };
}) {
  return <ProfileStudio profile={profile} stats={stats} />;
}
