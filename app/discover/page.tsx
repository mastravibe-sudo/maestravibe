"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Compass, Search, ShoppingBag, ShoppingCart, Users } from "lucide-react";
import { useCurrentUser } from "@/components/CurrentUserContext";
import { createClient } from "@/lib/supabase/client";
import { requestActivityPush } from "@/lib/notifications/client";

type Person = { id: string; username: string; name: string | null; avatar_url: string | null };
type Product = { id: string; title: string; price: number; currency: string; image_url: string | null; url: string };
type Tab = "Discover" | "Following" | "Followers" | "Requests";
const tabs: Tab[] = ["Discover", "Following", "Followers", "Requests"];
const interests = ["Music", "Art", "Travel", "Wellness", "Style", "Technology"];
const card = "rounded-2xl border border-white/[0.06] bg-[#110f2e]";

function Avatar({ person }: { person: Person }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-[#7c3aed] to-[#2563eb] text-sm font-bold text-white">
      {person.avatar_url ? <img src={person.avatar_url} alt="" className="h-full w-full object-cover" /> : (person.name || person.username).slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function DiscoverPage() {
  const { userId, ready } = useCurrentUser();
  const [supabase] = useState(() => createClient());
  const [people, setPeople] = useState<Person[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [followers, setFollowers] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("Discover");
  const [search, setSearch] = useState("");
  const [interest, setInterest] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError("");
    const peopleResult = await supabase.from("profiles").select("id,username,name,avatar_url").order("created_at", { ascending: false }).limit(80);
    let followingIds: string[] = [];
    let followerIds: string[] = [];
    if (userId) {
      const [followingResult, followersResult] = await Promise.all([
        supabase.from("follows").select("followed_id").eq("follower_id", userId),
        supabase.from("follows").select("follower_id").eq("followed_id", userId),
      ]);
      const followError = followingResult.error ?? followersResult.error;
      if (followError) setError(followError.message);
      followingIds = (followingResult.data ?? []).map((row) => row.followed_id as string);
      followerIds = (followersResult.data ?? []).map((row) => row.follower_id as string);
    }
    if (peopleResult.error) setError(peopleResult.error.message);
    setPeople(((peopleResult.data ?? []) as Person[]).filter((person) => person.id !== userId));
    setFollowing(followingIds);
    setFollowers(followerIds);
    setLoading(false);
  }, [ready, supabase, userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    void fetch("/api/market/products")
      .then(async (response) => {
        const page = await response.json() as { items?: Product[]; error?: string };
        if (!response.ok) throw new Error(page.error || "Market is temporarily unavailable.");
        if (active) setProducts(Array.isArray(page.items) ? page.items.slice(0, 4) : []);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Market is temporarily unavailable.");
      });
    return () => { active = false; };
  }, []);

  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    return people.filter((person) => {
      if (query && !`${person.name ?? ""} ${person.username}`.toLowerCase().includes(query)) return false;
      if (tab === "Following" && !following.includes(person.id)) return false;
      if (tab === "Followers" && !followers.includes(person.id)) return false;
      if (tab === "Discover" && following.includes(person.id)) return false;
      return true;
    });
  }, [followers, following, people, search, tab]);

  const follow = async (person: Person) => {
    if (!userId || following.includes(person.id) || busyId) return;
    setBusyId(person.id);
    const { error: followError } = await supabase.from("follows").insert({ follower_id: userId, followed_id: person.id });
    if (followError) setError(followError.message);
    else {
      setFollowing((current) => [...current, person.id]);
      const pushError = await requestActivityPush({ type: "follow", profileId: person.id });
      if (pushError) setError(pushError);
    }
    setBusyId(null);
  };

  const personCard = (person: Person) => (
    <article key={person.id} className={`${card} flex min-w-0 items-center gap-3 p-3`}>
      <Link href={`/${person.username}`} aria-label={`View ${person.name || person.username}`}><Avatar person={person} /></Link>
      <Link href={`/${person.username}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{person.name || person.username}</p>
        <p className="truncate text-xs text-[#a8a2c9]">@{person.username}</p>
      </Link>
      {userId && !following.includes(person.id) ? <button type="button" disabled={busyId === person.id} onClick={() => void follow(person)} className="min-h-10 rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] px-3 text-xs font-semibold text-white disabled:opacity-50">{busyId === person.id ? "..." : "Follow"}</button> : null}
      {userId ? <Link href={`/inbox?user=${encodeURIComponent(person.id)}`} className="min-h-10 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[#d7d2ef]">Message</Link> : null}
    </article>
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-6 px-4 py-5 pb-24 text-[#f4f2ff] sm:px-6">
      <section className="relative overflow-hidden rounded-3xl border border-violet-300/15 bg-linear-to-br from-[#24114b] via-[#151033] to-[#101d46] p-6 sm:p-8">
        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-200"><Compass className="h-4 w-4" />Explore Maestra Vibe</p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">Find Amazing People</h1>
          <p className="mt-2 text-sm text-[#c9c4e8]">Discover creators, find your people, and explore fresh ideas.</p>
          <a href="#suggested" className="mt-5 inline-flex min-h-11 items-center rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] px-5 text-sm font-semibold text-white">Explore people</a>
        </div>
        <Users aria-hidden="true" className="absolute -bottom-5 -right-3 h-40 w-40 text-white/5 sm:h-56 sm:w-56" />
      </section>

      {error ? <p role="alert" className="rounded-xl border border-pink-400/20 bg-pink-400/10 p-3 text-sm text-pink-100">{error}</p> : null}

      <section id="suggested" className="space-y-3">
        <header className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Suggested for you</h2><p className="text-xs text-[#a8a2c9]">People to follow and message</p></div><Link href="/friends" className="text-sm font-semibold text-violet-300">Friends</Link></header>
        {loading ? <div className="flex gap-3 overflow-hidden"><div className={`${card} h-20 w-64 animate-pulse`} /><div className={`${card} h-20 w-64 animate-pulse`} /></div> : (
          <div className="flex snap-x gap-3 overflow-x-auto pb-2">
            {people.filter((person) => !following.includes(person.id)).slice(0, 12).map((person) => <div key={person.id} className="w-[min(86vw,20rem)] shrink-0 snap-start">{personCard(person)}</div>)}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Popular Interests</h2>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {interests.map((item) => <button key={item} type="button" onClick={() => setInterest((current) => current === item ? null : item)} aria-pressed={interest === item} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm ${interest === item ? "border-transparent bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-white" : "border-white/10 bg-[#110f2e] text-[#c9c4e8]"}`}># {item}</button>)}
        </div>
        {interest ? <p className="text-xs text-[#a8a2c9]">Interest filters are coming soon. Use search to find people by name.</p> : null}
      </section>

      <section className="space-y-4">
        <div className="flex gap-1 overflow-x-auto rounded-full bg-[#110f2e] p-1" role="tablist" aria-label="Discover people">
          {tabs.map((item) => <button key={item} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)} className={`min-h-10 flex-1 rounded-full px-3 text-xs font-semibold sm:text-sm ${tab === item ? "bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-white" : "text-[#a8a2c9]"}`}>{item}</button>)}
        </div>
        <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a8a2c9]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search people" className="h-11 w-full rounded-xl border border-white/10 bg-[#110f2e] pl-10 pr-3 text-sm outline-none placeholder:text-[#817b9f] focus:border-violet-400" /></label>
        {tab === "Requests" ? <p className={`${card} p-6 text-center text-sm text-[#a8a2c9]`}>You don&apos;t have any follow requests.</p> : loading ? <p className="py-8 text-center text-sm text-[#a8a2c9]">Loading people...</p> : filteredPeople.length ? <div className="grid gap-2 sm:grid-cols-2">{filteredPeople.map(personCard)}</div> : <p className={`${card} p-6 text-center text-sm text-[#a8a2c9]`}>No people to show yet.</p>}
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between p-4"><div><h2 className="text-lg font-bold">Maestra Market</h2><p className="text-xs text-[#a8a2c9]">Discover products from the community</p></div><Link href="/market" aria-label="Explore Maestra Market" className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-white"><ShoppingBag className="h-5 w-5" /></Link></div>
        {products.length ? <div className="grid grid-cols-2 gap-3 p-3 pt-0 sm:grid-cols-4">{products.map((product) => <a key={product.id} href={product.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#07061a]">
          <div className="aspect-square bg-[#1d1840]">{product.image_url ? <img src={product.image_url} alt="" className="h-full w-full object-cover" /> : null}</div>
          <div className="flex items-center gap-2 p-2"><span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{product.title}</span><span className="mt-1 block text-xs text-violet-200">{product.currency} {product.price}</span></span><ShoppingCart className="h-4 w-4 shrink-0 text-violet-300" /></div>
        </a>)}</div> : <Link href="/market" className="block px-4 pb-4 text-sm font-semibold text-violet-300">Explore all products →</Link>}
        <Link href="/market" className="block border-t border-white/[0.06] py-3 text-center text-sm font-semibold text-violet-300">Open Market</Link>
      </section>
    </main>
  );
}
