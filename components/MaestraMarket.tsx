// path: maestra-vibe/components/MaestraMarket.tsx  (NEW file)
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Heart, Minus, Plus, ShoppingBag, ShoppingCart, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product = { id: string; title: string; price: number; currency: string; image: string | null; url: string; category: string };
type Item = { product_id: string; kind: "saved" | "cart"; title: string; price: number; currency: string; image: string | null; url: string | null; qty: number };
const BRAND = "bg-linear-to-r from-violet-600 via-fuchsia-500 to-blue-500";
const money = (n: number, c: string) => `${c === "USD" ? "$" : c + " "}${n.toFixed(2)}`;

export default function MaestraMarket() {
  const [supabase] = useState(() => createClient());
  const [products, setProducts] = useState<Product[]>([]);
  const [base, setBase] = useState("https://maestra-market.vercel.app");
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [tab, setTab] = useState<"shop" | "saved" | "cart">("shop");
  const [cat, setCat] = useState("All");
  const [error, setError] = useState("");

  const loadItems = useCallback(async (uid: string) => {
    const { data, error: err } = await supabase.from("market_items").select("product_id,kind,title,price,currency,image,url,qty").eq("user_id", uid);
    if (err) setError(/relation|schema cache/i.test(err.message) ? "Run supabase/migrations/market_items.sql in Supabase to enable Saved and Cart." : err.message);
    else setItems((data ?? []) as Item[]);
  }, [supabase]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/market/products");
      const json = (await res.json()) as { products: Product[]; base: string; error?: string };
      setProducts(json.products); setBase(json.base); setApiError(json.error ?? ""); setLoading(false);
      const { data: { user } } = await supabase.auth.getUser();
      setMe(user?.id ?? null);
      if (user) await loadItems(user.id);
    })();
  }, [supabase, loadItems]);

  const cats = useMemo(() => ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))], [products]);
  const shown = products.filter((p) => cat === "All" || p.category === cat);
  const has = (id: string, kind: Item["kind"]) => items.find((i) => i.product_id === id && i.kind === kind);

  const toggle = async (p: Product, kind: Item["kind"]) => {
    if (!me) return setError("Log in to save products or use the cart.");
    const existing = has(p.id, kind);
    const { error: err } = existing
      ? await supabase.from("market_items").delete().eq("user_id", me).eq("product_id", p.id).eq("kind", kind)
      : await supabase.from("market_items").insert({ user_id: me, product_id: p.id, kind, title: p.title, price: p.price, currency: p.currency, image: p.image, url: p.url, qty: 1 });
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
  const tabBtn = (t: typeof tab, label: string, n?: number) => <button key={t} onClick={() => setTab(t)} className={`h-11 flex-1 rounded-full text-sm font-medium ${tab === t ? `${BRAND} text-white shadow` : "text-slate-500"}`}>{label}{n ? ` (${n})` : ""}</button>;
  const open = (url: string | null) => url && window.open(url, "_blank", "noopener,noreferrer");
  const btn = "flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium active:scale-95";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 py-5 pb-24 sm:px-5">
      <header className="mb-4">
        <h1 className={`${BRAND} bg-clip-text text-3xl font-extrabold text-transparent`}>Maestra Market</h1>
        <p className="mt-1 text-sm text-slate-500">Shop products from Maestra Market. Orders and payment are completed on Maestra Market.</p>
      </header>
      <div className="mb-4 flex gap-1 rounded-full bg-slate-100/60 p-1">{tabBtn("shop", "Shop")}{tabBtn("saved", "Saved", saved.length)}{tabBtn("cart", "Cart", cart.length)}</div>
      {error ? <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {tab === "shop" ? (
        <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">{cats.map((c) => <button key={c} onClick={() => setCat(c)} className={`h-10 shrink-0 rounded-full border px-4 text-sm ${cat === c ? "border-transparent bg-slate-900 text-white" : "border-slate-200 text-slate-600"}`}>{c}</button>)}</div>
          {loading ? <p className="py-12 text-center text-slate-500">Loading products...</p> : shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
              <p className="font-medium">{apiError || "No products found."}</p>
              <a href={base} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-violet-600">Visit Maestra Market <ExternalLink className="h-4 w-4" /></a>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {shown.map((p) => (
                <article key={p.id} className="home-feed-card overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="relative aspect-square bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.image ? <img src={p.image} alt={p.title} loading="lazy" className="h-full w-full object-cover" /> : null}
                    <button onClick={() => void toggle(p, "saved")} aria-label={has(p.id, "saved") ? "Remove from saved" : "Save"} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-pink-500 shadow"><Heart className={`h-5 w-5 ${has(p.id, "saved") ? "fill-current" : ""}`} /></button>
                  </div>
                  <div className="space-y-2 p-3">
                    <h2 className="line-clamp-2 min-h-10 text-sm font-medium">{p.title}</h2>
                    <p className="text-lg font-bold">{money(p.price, p.currency)}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => void toggle(p, "cart")} className={`${btn} ${has(p.id, "cart") ? "bg-slate-100 text-slate-700" : `${BRAND} text-white`}`}><ShoppingCart className="h-4 w-4" aria-hidden="true" />{has(p.id, "cart") ? "In cart" : "Add"}</button>
                      <button onClick={() => open(p.url)} className={`${btn} border border-slate-200 text-slate-700`}>Buy</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      ) : null}

      {tab !== "shop" && !me ? <Link href="/login" className={`${BRAND} block rounded-xl py-3 text-center font-semibold text-white`}>Log in to use your {tab}</Link> : null}
      {tab === "saved" && me ? (saved.length ? <div className="space-y-2">{saved.map((i) => <ItemRow key={i.product_id} i={i} onRemove={() => void remove(i)} onOpen={() => open(i.url)} />)}</div> : <p className="py-12 text-center text-slate-500">No saved products yet. Tap the heart on a product.</p>) : null}
      {tab === "cart" && me ? (cart.length ? (
        <div className="space-y-2">
          {cart.map((i) => <ItemRow key={i.product_id} i={i} onRemove={() => void remove(i)} onOpen={() => open(i.url)} qty={{ value: i.qty, set: (q) => void setQty(i, q) }} />)}
          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"><span className="font-medium">Total</span><span className="text-xl font-bold">{money(total, cart[0].currency)}</span></div>
          <button onClick={() => open(base)} className={`${BRAND} flex h-12 w-full items-center justify-center gap-2 rounded-xl font-semibold text-white`}>Continue on Maestra Market <ExternalLink className="h-4 w-4" /></button>
          <p className="text-center text-xs text-slate-500">Payment and delivery details are completed on Maestra Market.</p>
        </div>
      ) : <p className="py-12 text-center text-slate-500">Your cart is empty.</p>) : null}
    </main>
  );
}

function ItemRow({ i, onRemove, onOpen, qty }: { i: Item; onRemove: () => void; onOpen: () => void; qty?: { value: number; set: (q: number) => void } }) {
  const b = "flex h-9 w-9 items-center justify-center rounded-full border border-slate-200";
  return (
    <div className="home-feed-card flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {i.image ? <img src={i.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" /> : <div className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />}
      <div className="min-w-0 flex-1"><button onClick={onOpen} className="line-clamp-2 text-left text-sm font-medium">{i.title}</button><p className="font-bold">{money(i.price, i.currency)}</p></div>
      {qty ? <div className="flex items-center gap-2"><button className={b} aria-label="Decrease" onClick={() => qty.set(qty.value - 1)}><Minus className="h-4 w-4" /></button><span className="w-5 text-center text-sm">{qty.value}</span><button className={b} aria-label="Increase" onClick={() => qty.set(qty.value + 1)}><Plus className="h-4 w-4" /></button></div> : null}
      <button onClick={onRemove} aria-label="Remove" className="flex h-11 w-11 items-center justify-center text-slate-400 hover:text-red-500"><Trash2 className="h-5 w-5" /></button>
    </div>
  );
}