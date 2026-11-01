// path: maestra-vibe/components/MaestraMarket.tsx  (NEW file)
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ExternalLink, Heart, Minus, Plus, Search, ShoppingBag, ShoppingCart, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product = { id: string; title: string; price: number; currency: string; image_url: string | null; images?: string[]; url: string; in_stock: boolean };
type Item = { product_id: string; kind: "saved" | "cart"; title: string; price: number; currency: string; image: string | null; url: string | null; qty: number };
type ProductPage = { items?: Product[]; next_cursor?: string | null; base?: string; error?: string };
type ProductSort = "newest" | "price-low" | "price-high";
type PriceRange = "all" | "under-1000" | "1000-5000" | "5000-plus";
const BRAND = "bg-linear-to-r from-violet-600 via-fuchsia-500 to-blue-500";
const money = (n: number, c: string) => `${c === "USD" ? "$" : c + " "}${n.toFixed(2)}`;
const detailMoney = (n: number) => `PKR ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const productImages = (product: Product) => {
  const images = product.images?.filter((image) => typeof image === "string" && image.length > 0) ?? [];
  return images.length ? images : product.image_url ? [product.image_url] : [];
};

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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [priceRange, setPriceRange] = useState<PriceRange>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

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
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = products.filter((product) => {
      if (query && !product.title.toLocaleLowerCase().includes(query)) return false;
      if (priceRange === "under-1000" && product.price >= 1000) return false;
      if (priceRange === "1000-5000" && (product.price < 1000 || product.price >= 5000)) return false;
      if (priceRange === "5000-plus" && product.price < 5000) return false;
      return true;
    });
    if (sort === "price-low") return filtered.sort((a, b) => a.price - b.price);
    if (sort === "price-high") return filtered.sort((a, b) => b.price - a.price);
    return filtered;
  }, [products, priceRange, search, sort]);

  const clearFilters = () => {
    setSearch("");
    setSort("newest");
    setPriceRange("all");
  };
  const openDetails = (product: Product) => {
    setSelectedProduct(product);
    setGalleryIndex(0);
  };
  const closeDetails = () => {
    setSelectedProduct(null);
    touchStart.current = null;
  };
  const handleGalleryTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const deltaX = event.changedTouches[0].clientX - start.x;
    const deltaY = event.changedTouches[0].clientY - start.y;
    if (deltaY > 75 && Math.abs(deltaY) > Math.abs(deltaX)) {
      closeDetails();
      return;
    }
    const imageCount = selectedProduct ? productImages(selectedProduct).length : 0;
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) && imageCount > 1) {
      setGalleryIndex((current) => (current + (deltaX < 0 ? 1 : -1) + imageCount) % imageCount);
    }
  };

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
          <div className="mb-4 space-y-3">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a8a2c9]" aria-hidden="true" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" aria-label="Search products by title" className="h-11 w-full rounded-xl border border-white/10 bg-[#141028] pl-10 pr-3 text-sm text-white outline-none placeholder:text-[#817b9f] focus:border-violet-400" />
            </label>
            <label className="flex items-center gap-3 text-sm text-[#c9c4e8]">
              <span className="shrink-0">Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as ProductSort)} className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[#141028] px-3 text-sm text-white outline-none focus:border-violet-400">
                <option value="newest">Newest</option>
                <option value="price-low">Price low to high</option>
                <option value="price-high">Price high to low</option>
              </select>
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filter by price">
              {([
                ["all", "Any price"],
                ["under-1000", "Under 1000"],
                ["1000-5000", "1000-5000"],
                ["5000-plus", "5000+"],
              ] as const).map(([value, label]) => (
                <button key={value} type="button" onClick={() => setPriceRange(value)} aria-pressed={priceRange === value} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm ${priceRange === value ? "border-transparent bg-[#f4f2ff] text-[#09061a]" : "border-white/20 text-[#c9c4e8]"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {loading ? <p className="py-12 text-center text-[#a8a2c9]">Loading products...</p> : products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-[#a8a2c9]" aria-hidden="true" />
              <p className="font-medium">{apiError || "No products found."}</p>
              {base ? <a href={base} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-violet-300">Visit Maestra Market <ExternalLink className="h-4 w-4" /></a> : null}
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 p-8 text-center">
              <ShoppingBag className="mx-auto mb-2 h-8 w-8 text-[#a8a2c9]" aria-hidden="true" />
              <p className="font-medium">No products match those filters.</p>
              <button type="button" onClick={clearFilters} className="mt-3 min-h-11 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/15">Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map((p) => (
                <article key={p.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#141028] shadow-sm">
                  <div className="relative aspect-square bg-[#1d1840]">
                    <button type="button" onClick={() => openDetails(p)} aria-label={`View ${p.title}`} className="absolute inset-0 block h-full w-full text-left">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.image_url ? <img src={p.image_url} alt={p.title} loading="lazy" className="h-full w-full object-cover" /> : null}
                      <span className="sr-only">View product details</span>
                    </button>
                    <button onClick={() => void toggle(p, "saved")} aria-label={has(p.id, "saved") ? "Remove from saved" : "Save"} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-[#09061a]/80 text-pink-500 shadow"><Heart className={`h-5 w-5 ${has(p.id, "saved") ? "fill-current" : ""}`} /></button>
                  </div>
                  <div className="space-y-2 p-3">
                    <button type="button" onClick={() => openDetails(p)} className="line-clamp-2 min-h-10 w-full text-left text-sm font-medium">{p.title}</button>
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

      {selectedProduct ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4" onClick={closeDetails}>
          <section role="dialog" aria-modal="true" aria-label={`${selectedProduct.title} details`} onClick={(event) => event.stopPropagation()} onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={handleGalleryTouchEnd} className="relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[28px] border border-white/10 bg-[#100c24] pb-[max(1rem,env(safe-area-inset-bottom))] text-white shadow-2xl sm:rounded-[28px]">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-[#100c24]/95 px-4 py-3 backdrop-blur">
              <h2 className="line-clamp-1 pr-3 text-base font-semibold">{selectedProduct.title}</h2>
              <button type="button" onClick={closeDetails} aria-label="Close product details" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/5 text-zinc-200"><X className="h-5 w-5" /></button>
            </div>
            <div className="relative aspect-square max-h-[52dvh] w-full touch-pan-y overflow-hidden bg-[#1d1840]" onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {productImages(selectedProduct).length ? <img src={productImages(selectedProduct)[galleryIndex]} alt={`${selectedProduct.title} image ${galleryIndex + 1}`} className="h-full w-full object-contain" /> : <div className="flex h-full items-center justify-center text-sm text-zinc-400">No product image</div>}
              {productImages(selectedProduct).length > 1 ? (
                <>
                  <button type="button" aria-label="Previous image" onClick={() => setGalleryIndex((current) => (current - 1 + productImages(selectedProduct).length) % productImages(selectedProduct).length)} className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"><ChevronLeft className="h-5 w-5" /></button>
                  <button type="button" aria-label="Next image" onClick={() => setGalleryIndex((current) => (current + 1) % productImages(selectedProduct).length)} className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white"><ChevronRight className="h-5 w-5" /></button>
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{galleryIndex + 1} / {productImages(selectedProduct).length}</span>
                </>
              ) : null}
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-2xl font-bold">{detailMoney(selectedProduct.price)}</p>
                <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedProduct.in_stock ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}>{selectedProduct.in_stock ? "In stock" : "Out of stock"}</span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <a href={selectedProduct.url} target="_blank" rel="noopener noreferrer" className={`${BRAND} flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-white`}>
                  Buy on Maestra Market <ExternalLink className="h-4 w-4" />
                </a>
                <button type="button" onClick={() => void toggle(selectedProduct, "saved")} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10">
                  <Heart className={`h-4 w-4 ${has(selectedProduct.id, "saved") ? "fill-current text-pink-400" : ""}`} />
                  {has(selectedProduct.id, "saved") ? "Saved" : "Add to saved"}
                </button>
              </div>
              <p className="text-center text-xs text-zinc-500">Swipe down to close</p>
            </div>
          </section>
        </div>
      ) : null}
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