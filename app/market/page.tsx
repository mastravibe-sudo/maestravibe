"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type Listing = { id: string; seller_id: string; title: string; description: string; category: string; price: number; image_url: string | null; created_at: string };
type Seller = { id: string; username: string; name: string | null; avatar_url: string | null };
const categories = ["All", "Art & Design", "Music", "Services", "Digital", "Other"];
const fieldClass = "w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-violet-400";

export default function MarketPage() {
  const [supabase] = useState(() => createClient());
  const [userId, setUserId] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [sellers, setSellers] = useState<Record<string, Seller>>({});
  const [category, setCategory] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [listingCategory, setListingCategory] = useState("Services");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    const { data, error: queryError } = await supabase
      .from("marketplace_listings")
      .select("id,seller_id,title,description,category,price,image_url,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(60);
    if (queryError) {
      setError(queryError.message);
      setListings([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Listing[];
    setListings(rows);
    const sellerIds = [...new Set(rows.map((row) => row.seller_id))];
    if (sellerIds.length) {
      const { data: profiles, error: sellerError } = await supabase.from("profiles").select("id,username,name,avatar_url").in("id", sellerIds);
      if (sellerError) setError(sellerError.message);
      else setSellers(Object.fromEntries(((profiles ?? []) as Seller[]).map((seller) => [seller.id, seller])));
    } else setSellers({});
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const filtered = useMemo(() => category === "All" ? listings : listings.filter((item) => item.category === category), [category, listings]);

  const createListing = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("marketplace_listings").insert({
      seller_id: userId,
      title: title.trim(),
      description: description.trim(),
      category: listingCategory,
      price: Number(price),
      image_url: imageUrl.trim() || null,
    });
    if (insertError) setError(insertError.message);
    else {
      setTitle("");
      setDescription("");
      setPrice("0");
      setImageUrl("");
      setShowForm(false);
      await load();
    }
    setSaving(false);
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 pb-24 text-zinc-100 md:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Community exchange</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Market</h1>
          <p className="mt-2 text-sm text-zinc-400">Discover creative work and services from the community.</p>
        </div>
        {userId ? <button onClick={() => setShowForm((current) => !current)} className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-400">{showForm ? "Close form" : "Create listing"}</button> : <Link href="/login" className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-zinc-200">Log in to sell</Link>}
      </header>

      {showForm ? (
        <form onSubmit={createListing} className="mb-7 grid gap-3 rounded-xl border border-white/10 bg-zinc-900 p-4 sm:grid-cols-2 sm:p-5">
          <label className="sm:col-span-2"><span className="mb-1.5 block text-xs text-zinc-400">Listing title</span><input required minLength={3} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClass} placeholder="What are you offering?" /></label>
          <label><span className="mb-1.5 block text-xs text-zinc-400">Category</span><select value={listingCategory} onChange={(event) => setListingCategory(event.target.value)} className={fieldClass}>{categories.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}</select></label>
          <label><span className="mb-1.5 block text-xs text-zinc-400">Price (USD)</span><input type="number" min="0" step="0.01" required value={price} onChange={(event) => setPrice(event.target.value)} className={fieldClass} /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-xs text-zinc-400">Description</span><textarea maxLength={2000} rows={4} value={description} onChange={(event) => setDescription(event.target.value)} className={`${fieldClass} resize-y`} placeholder="Share details about your offer" /></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-xs text-zinc-400">Cover image URL (optional)</span><input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className={fieldClass} placeholder="https://..." /></label>
          <div className="flex justify-end sm:col-span-2"><button disabled={saving} className="rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50">{saving ? "Publishing..." : "Publish listing"}</button></div>
        </form>
      ) : null}

      {error ? <p role="alert" className="mb-4 border border-amber-400/20 bg-amber-950/30 p-3 text-sm text-amber-100">{error.includes("marketplace_listings") ? "Run the social sections SQL migration to enable Market." : error}</p> : null}
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
        {categories.map((item) => <button key={item} onClick={() => setCategory(item)} className={`shrink-0 rounded-full px-3 py-2 text-xs font-medium ${category === item ? "bg-white text-zinc-950" : "border border-white/10 text-zinc-400 hover:text-white"}`}>{item}</button>)}
      </div>

      {loading ? <p className="py-14 text-center text-sm text-zinc-500">Loading listings...</p> : filtered.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const seller = sellers[item.seller_id];
            return (
              <article key={item.id} className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
                {item.image_url ? <img src={item.image_url} alt="" className="aspect-16/10 w-full object-cover" /> : <div className="flex aspect-16/10 items-center justify-center bg-[linear-gradient(135deg,#10251f,#18212c_55%,#35234a)] text-4xl">✳</div>}
                <div className="p-4">
                  <div className="mb-2 flex items-start justify-between gap-3"><span className="rounded-full bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-200">{item.category}</span><span className="shrink-0 text-sm font-semibold text-white">{Number(item.price) === 0 ? "Free" : `$${Number(item.price).toFixed(2)}`}</span></div>
                  <h2 className="text-base font-semibold text-white">{item.title}</h2>
                  <p className="mt-2 line-clamp-3 min-h-12 text-sm leading-relaxed text-zinc-400">{item.description || "No description provided."}</p>
                  {seller ? <Link href={`/${seller.username}`} className="mt-4 flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-zinc-400 hover:text-white"><span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-zinc-800 text-white">{seller.avatar_url ? <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" /> : (seller.name || seller.username).slice(0, 1).toUpperCase()}</span><span>by {seller.name || `@${seller.username}`}</span></Link> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : <p className="border-y border-white/10 py-14 text-center text-sm text-zinc-500">No listings in this category yet.</p>}
    </main>
  );
}
