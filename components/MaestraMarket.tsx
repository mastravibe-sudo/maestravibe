// path: maestra-vibe/components/MaestraMarket.tsx  (NEW file)
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Heart, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product = { id: string; title: string; price: number; currency: string; image_url: string | null; url: string; in_stock: boolean };
type Item = { product_id: string; kind: "saved" | "cart"; title: string; price: number; currency: string; image: string | null; url: string | null; qty: number };
type ProductPage = { items?: Product[]; next_cursor?: string | null; base?: string; error?: string };
const BRAND = "bg-linear-to-r from-violet-600 via-fuchsia-500 to-blue-500";
const money = (n: number, c: string) => `${c === "USD" ? "$" : c + " "}${n.toFixed(2)}`;

export default function MaestraMarket() {
  const [supabase] = useState(() => createClient());
  const [products, setProducts] = useState<Product[]>([]);
  const [base, setBase] = useState("");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<"shop" | "saved" | "cart">("shop");
  const [error, setError] = useState("");

  const loadItems = useCallback(async (uid: string) => {
    const { data, error: err } = await supabase.from("market_items").select("product_id,kind,title,price,currency,image,url,qty").eq("user_id", uid);
    if (err) setError(/relation|schema cache/i.test(err.message) ? "Run supabase/migrations/market_items.sql in Supabase to enable Saved and Cart." : err.message);
    else setItems((data ?? []) as Item[]);
  }, [supabase]);

  const loadProducts = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/market/products${params.size ? `?${params}` : ""}`);
      const page = await response.json() as ProductPage;
      setBase(page.base ?? "");
      if (!response.ok) throw new Error(page.error || "Maestra Market products are temporarily unavailable.");
      const items = Array.isArray(page.items) ? page.items : [];
      setProducts((current) => cursor
        ? [...current, ...items.filter((item) => !current.some((existing) => existing.id === item.id))]
        : items);
      setNextCursor(typeof page.next_cursor === "string" ? page.next_cursor : null);
      setApiError(page.error ?? "");
    } catch (loadError) {
      setApiError(loadError instanceof Error ? loadError.message : "Maestra Market products are temporarily unavailable.");
      if (!cursor) {
        setProducts([]);
        setNextCursor(null);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await loadProducts();
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user?.id ?? null);
      if (user) await loadItems(user.id);
    })();
  }, [supabase, loadItems, loadProducts]);

  const has = (id: string, kind: Item["kind"]) => items.find((i) => i.product_id === id && i.kind === kind);

  const toggle = async (p: Product, kind: Item["kind"]) => {
    if (!me) return setError("Log in to save products or use the cart.");
    const existing = has(p.id, kind);
    const { error: err } = existing
      ? await supabase.from("market_items").delete().eq("user_id", me).eq("product_id", p.id).eq("kind", kind)
      : await supabase.from("market_items").insert({ user_id: me, product_id: p.id, kind, title: p.title, price: p.price, currency: p.currency, image: p.image_url, url: p.url, qty: 1 });
    if (err) setError(err.message);
    await loadItems(me);
  };
  const setQty = async (i: Item, qty: number) => {
    if (!me || qty < 1 || qty > 99) return;
    await supabase.from("market_items").update({ qty }).eq("user_id", me).eq("product_id", i.product_id).eq("kind", "cart");
    await loadItems(me);
  };
  const remove = async (i: Item) => { if (!me) return; await supabase.from("market_items").delete().eq("user_id", me).eq("product_id", i.product_id).eq("kind", i.kind); await loadItems(me); };

  const cart = items.filter((i) => i.kind === "cart");
  const saved = items.filter((i) => i.kind === "saved");
  const total = cart.reduce((n, i) => n + i.price * i.qty, 0);
  const tabBtn = (t: typeof tab, label: string, n?: number) => <button key={t} onClick={() => setTab(t)} className={`h-11 flex-1 rounded-full text-sm font-medium ${tab === t ? `${BRAND} text-white shadow` : "text-[#a8a2c9]"}`}>{label}{n ? ` (${n})` : ""}</button>;
  const open = (url: string | null) => url && window.open(url, "_blank", "noopener,noreferrer");
  const btn = "flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium active:scale-95";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 py-5 pb-24 sm:px-5">
      <header className="mb-4">
        <h1 className={`${BRAND} bg-clip-text text-3xl font-extrabold text-transparent`}>Maestra Market</h1>
        <p className="mt-1 text-sm text-[#a8a2c9]">Shop products from Maestra Market. Orders and payment are completed on Maestra Market.</p>
      </header>
      <div className="mb-4 flex gap-1 rounded-full bg-[#141028] p-1">{tabBtn("shop", "Shop")}{tabBtn("saved", "Saved", saved.length)}{tabBtn("cart", "Cart", cart.length)}</div>
      {error ? <p role="alert" className="mb-3 rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{error}</p> : null}

      {tab === "shop" ? (
        <>
          {loading ? <p className="py-12 text-center text-[#a8a2c9]">Loading products...</p> : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-[#a8a2c9]" aria-hidden="true" />
              <p className="font-medium">{apiError || "No products found."}</p>
              {base ? <a href={base} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-violet-300">Visit Maestra Market <ExternalLink className="h-4 w-4" /></a> : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <article key={p.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#141028] shadow-sm">
                  <div className="relative aspect-square bg-[#1d1840]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image_url ? <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover" /> : null}
                    <button onClick={() => void toggle(p, "saved")} aria-label={has(p.id, "saved") ? "Remove from saved" : "Save"} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#09061a]/80 text-pink-500 shadow"><Heart className={`h-5 w-5 ${has(p.id, "saved") ? "fill-current" : ""}`} /></button>
                  </div>
                  <div className="space-y-2 p-3">
                    <h2 className="line-clamp-2 min-h-10 text-sm font-medium">{p.title}</h2>
                    <p className="text-lg font-bold">{money(p.price, p.currency)}</p>
                    {!p.in_stock ? <p className="text-xs font-medium text-amber-300">Out of stock</p> : null}
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => void toggle(p, "cart")} disabled={!p.in_stock} className={`${btn} ${has(p.id, "cart") ? "bg-[#1d1840] text-[#e4e0ff]" : `${BRAND} text-white`} disabled:cursor-not-allowed disabled:opacity-45`}><ShoppingCart className="h-4 w-4" aria-hidden="true" />{!p.in_stock ? "Unavailable" : has(p.id, "cart") ? "In cart" : "Add"}</button>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className={`${btn} border border-white/20 text-[#e4e0ff]`}>Buy</a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!loading && products.length > 0 && apiError ? <p role="alert" className="mt-4 rounded-lg bg-red-500/15 p-3 text-sm text-red-300">{apiError}</p> : null}
          {!loading && nextCursor ? (
            <button type="button" onClick={() => void loadProducts(nextCursor)} disabled={loadingMore} className={`${BRAND} mx-auto mt-5 flex min-h-11 items-center justify-center rounded-xl px-6 text-sm font-semibold text-white disabled:opacity-50`}>
              {loadingMore ? "Loading..." : "Load more"}
            </button>
          ) : null}
        </>
      ) : null}

      {tab !== "shop" && !me ? <Link href="/login" className={`${BRAND} block rounded-xl py-3 text-center font-semibold text-white`}>Log in to use your {tab}</Link> : null}
      {tab === "saved" && me ? (saved.length ? <div className="space-y-2">{saved.map((i) => <ItemRow key={i.product_id} i={i} onRemove={() => void remove(i)} onOpen={() => open(i.url)} />)}</div> : <p className="py-12 text-center text-[#a8a2c9]">No saved products yet. Tap the heart on a product.</p>) : null}
      {tab === "cart" && me ? (cart.length ? (
        <div className="space-y-2">
          {cart.map((i) => <ItemRow key={i.product_id} i={i} onRemove={() => void remove(i)} onOpen={() => open(i.url)} qty={{ value: i.qty, set: (q) => void setQty(i, q) }} />)}
          <div className="flex items-center justify-between rounded-2xl border border-white/20 bg-[#141028] p-4"><span className="font-medium">Total</span><span className="text-xl font-bold">{money(total, cart[0].currency)}</span></div>
          <button onClick={() => open(base)} className={`${BRAND} flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white`}>Continue on Maestra Market <ExternalLink className="h-4 w-4" /></button>
          <p className="text-center text-xs text-[#a8a2c9]">Payment and delivery details are completed on Maestra Market.</p>
        </div>
      ) : <p className="py-12 text-center text-[#a8a2c9]">Your cart is empty.</p>) : null}
    </main>
  );
}

function ItemRow({ i, onRemove, onOpen, qty }: { i: Item; onRemove: () => void; onOpen: () => void; qty?: { value: number; set: (q: number) => void } }) {
  const b = "flex h-9 w-9 items-center justify-center rounded-full border border-white/20";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#141028] p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {i.image ? <img src={i.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-[#1d1840]" />}
      <div className="min-w-0 flex-1"><button onClick={onOpen} className="line-clamp-2 text-left text-sm font-medium">{i.title}</button><p className="font-bold">{money(i.price, i.currency)}</p></div>
      {qty ? <div className="flex items-center gap-2"><button className={b} aria-label="Decrease" onClick={() => qty.set(qty.value - 1)}><Minus className="h-4 w-4" /></button><span className="w-5 text-center text-sm">{qty.value}</span><button className={b} aria-label="Increase" onClick={() => qty.set(qty.value + 1)}><Plus className="h-4 w-4" /></button></div> : null}
      <button onClick={onRemove} aria-label="Remove" className="flex h-11 w-11 items-center justify-center text-[#a8a2c9] hover:text-red-500"><Trash2 className="h-5 w-5" /></button>
    </div>
  );
}