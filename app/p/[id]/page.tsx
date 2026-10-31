// path: maestra-vibe/app/p/[id]/page.tsx  (NEW file, app ke andar p folder, phir [id] folder)
// Har post ka apna public page: share links, Google aur WhatsApp preview ke liye.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicClient } from "@/lib/supabase/public";
import { SITE_URL } from "@/lib/site";

type Media = { type: "image" | "video"; url: string };
type Post = {
  id: string; title: string | null; body: string; tags: string[] | null; location: string | null; media: Media[] | null;
  image_url: string | null; created_at: string;
  profiles: { username: string; name: string | null; avatar_url: string | null; visibility: string; discoverable: boolean };
};

async function getPost(id: string): Promise<Post | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await publicClient().from("posts")
    .select("id,title,body,tags,location,media,image_url,created_at,profiles!posts_user_id_fkey(username,name,avatar_url,visibility,discoverable)")
    .eq("id", id).maybeSingle();
  const post = data as unknown as Post | null;
  return post && post.profiles.visibility === "public" ? post : null; // private profiles ke posts yahan nahi
}

const heading = (p: Post) => p.title || p.body.slice(0, 70) || `Post by ${p.profiles.name || p.profiles.username}`;
const firstMedia = (p: Post): Media | null => (p.media && p.media.length ? p.media[0] : p.image_url ? { type: "image", url: p.image_url } : null);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const post = await getPost((await params).id);
  if (!post) return { title: "Post not found", robots: { index: false } };
  const m = firstMedia(post);
  const title = `${heading(post)} | ${post.profiles.name || post.profiles.username} on Maestra Vibe`;
  const description = post.body.slice(0, 160) || `A post by @${post.profiles.username} on Maestra Vibe.`;
  return {
    title, description,
    robots: post.profiles.discoverable ? { index: true, follow: true } : { index: false, follow: true },
    alternates: { canonical: `${SITE_URL}/p/${post.id}` },
    openGraph: { title, description, type: "article", url: `${SITE_URL}/p/${post.id}`, images: m?.type === "image" ? [m.url] : post.profiles.avatar_url ? [post.profiles.avatar_url] : undefined },
    twitter: { card: m?.type === "image" ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const post = await getPost((await params).id);
  if (!post) notFound();
  const a = post.profiles;
  const m = firstMedia(post);
  const ld = {
    "@context": "https://schema.org", "@type": "SocialMediaPosting", headline: heading(post), articleBody: post.body,
    datePublished: post.created_at, url: `${SITE_URL}/p/${post.id}`, author: { "@type": "Person", name: a.name || a.username, url: `${SITE_URL}/${a.username}` },
    ...(m?.type === "image" ? { image: m.url } : {}),
  };
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <article className="home-feed-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {m?.type === "video" ? <video src={m.url} controls playsInline className="max-h-[70vh] w-full bg-black" /> : m ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={m.url} alt={heading(post)} className="max-h-[70vh] w-full bg-black object-contain" /> : null}
        <div className="space-y-3 p-5">
          <Link href={`/${a.username}`} className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-zinc-700 font-semibold text-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {a.avatar_url ? <img src={a.avatar_url} alt="" className="h-full w-full object-cover" /> : (a.name || a.username).slice(0, 1).toUpperCase()}
            </span>
            <span><span className="block font-semibold">{a.name || a.username}</span><span className="text-sm text-slate-500">@{a.username}</span></span>
          </Link>
          {post.title ? <h1 className="text-xl font-bold">{post.title}</h1> : null}
          {post.body ? <p className="whitespace-pre-wrap text-base leading-relaxed">{post.body}</p> : null}
          {post.tags?.length ? <p className="flex flex-wrap gap-2 text-sm text-violet-600">{post.tags.map((t) => <span key={t}>#{t}</span>)}</p> : null}
          {post.location ? <p className="text-sm text-slate-500">{post.location}</p> : null}
          <Link href={`/?post=${post.id}`} className="mt-2 flex h-12 items-center justify-center rounded-xl bg-linear-to-r from-violet-600 via-fuchsia-500 to-blue-500 font-semibold text-white">Open in Maestra Vibe</Link>
        </div>
      </article>
    </main>
  );
}