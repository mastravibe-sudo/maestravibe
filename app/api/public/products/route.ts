// path: (MAESTRA MARKET project mein) app/api/public/products/route.ts  (NEW file)
// Maestra Vibe isay server se server parhta hai. Sirf wohi cheezein bhejo jo sab ko dikhni chahiyen
// (id, title, price, image, category, url). Kabhi stock cost, supplier info ya customer data mat bhejo.
import { NextResponse } from "next/server";

const SITE = "https://maestra-market.vercel.app";

// TODO: apne products ka asli source yahan jodo (database / products file) aur is shape mein wapas karo.
async function getProducts(limit: number) {
  return [] as { id: string | number; name: string; price: number; image?: string; category?: string; slug?: string }[];
}

export async function GET(req: Request) {
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 40, 100);
  const items = await getProducts(limit);
  return NextResponse.json(
    {
      products: items.map((p) => ({
        id: String(p.id),
        title: p.name,
        price: p.price,
        currency: "USD",
        image: p.image ? (p.image.startsWith("http") ? p.image : `${SITE}${p.image}`) : null,
        category: p.category ?? "",
        url: `${SITE}/product/${p.slug ?? p.id}`, // apne asli product page ka raasta likho
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } }
  );
}