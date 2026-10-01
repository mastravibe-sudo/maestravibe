"use client";

import type { ProfileRecord } from "@/lib/profile-schema";
import ProfileStudio from "@/components/ProfileStudio";

export default function ProfileBuilder({
  profile,
  stats,
}: {
  profile: ProfileRecord;
  stats: { followers: number; following: number };
}) {
  return <ProfileStudio profile={profile} stats={stats} />;
}
