// path: maestra-vibe/app/api/market/products/route.ts  (NEW file, app/api/market/products folder banao)
// Maestra Market se products la kar saaf (sanitize) karke Maestra Vibe ko deta hai.
import { NextResponse } from "next/server";

const BASE = (process.env.MAESTRA_MARKET_URL ?? "https://maestra-market.vercel.app").replace(/\/$/, "");
export const revalidate = 300;

type Product = { id: string; title: string; price: number; currency: string; image: string | null; url: string; category: string };

function clean(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = String(p.id ?? "").slice(0, 80);
  const title = String(p.title ?? "").slice(0, 160);
  const price = Number(p.price);
  if (!id || !title || !Number.isFinite(price) || price < 0) return null;
  const image = typeof p.image === "string" && /^https:\/\//i.test(p.image) ? p.image : null;
  let url = BASE;
  try {
    const u = new URL(String(p.url ?? ""), BASE);
    if (u.origin === new URL(BASE).origin) url = u.toString(); // sirf Maestra Market ke apne links
  } catch { /* default link */ }
  return { id, title, price, currency: String(p.currency ?? "USD").slice(0, 8), image, url, category: String(p.category ?? "").slice(0, 40) };
}

export async function GET() {
  try {
    const res = await fetch(`${BASE}/api/public/products?limit=60`, { next: { revalidate: 300 } });
    if (!res.ok) throw new Error(`Market responded ${res.status}`);
    const json = (await res.json()) as { products?: unknown[] };
    const products = (json.products ?? []).map(clean).filter((p): p is Product => p !== null);
    return NextResponse.json({ products, base: BASE });
  } catch {
    return NextResponse.json({ products: [], base: BASE, error: "Maestra Market products are not connected yet." });
  }
}