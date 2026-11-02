// path: maestra-vibe/app/sitemap.ts  (NEW file)
// Sirf public aur discoverable profiles aur un ki posts Google ko dikhti hain.
import type { MetadataRoute } from "next";
import { publicClient } from "@/lib/supabase/public";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = publicClient();
  const [people, posts] = await Promise.all([
    db.from("profiles").select("username,updated_at").eq("visibility", "public").eq("discoverable", true).limit(5000),
    db.from("posts").select("id,created_at,profiles!posts_user_id_fkey!inner(visibility,discoverable)").eq("profiles.visibility", "public").eq("profiles.discoverable", true).order("created_at", { ascending: false }).limit(5000),
  ]);
  if (people.error) throw new Error(`Could not load public profiles for sitemap: ${people.error.message}`);
  if (posts.error) throw new Error(`Could not load public posts for sitemap: ${posts.error.message}`);
  return [
    ...(people.data ?? []).map((p) => ({ url: `${SITE_URL}/${p.username}`, lastModified: p.updated_at ?? undefined, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...(posts.data ?? []).map((p) => ({ url: `${SITE_URL}/p/${p.id}`, lastModified: p.created_at, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}