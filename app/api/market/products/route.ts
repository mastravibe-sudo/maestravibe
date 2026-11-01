import { NextResponse } from "next/server";

export const revalidate = 60;

const PAGE_SIZE = 24;
const MAX_CURSOR_LENGTH = 2_048;

type MarketProduct = {
  id: string;
  title: string;
  price: number;
  currency: string;
  image_url: string | null;
  images?: string[];
  url: string;
  in_stock: boolean;
};

function readProduct(value: unknown, marketOrigin: string): MarketProduct | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const product = value as Record<string, unknown>;
  if (
    (typeof product.id !== "string" && typeof product.id !== "number") ||
    typeof product.title !== "string" ||
    typeof product.price !== "number" ||
    !Number.isFinite(product.price) ||
    product.price < 0 ||
    typeof product.currency !== "string" ||
    !product.currency.trim() ||
    typeof product.in_stock !== "boolean" ||
    (product.image_url !== null && typeof product.image_url !== "string") ||
    typeof product.url !== "string"
  ) return null;

  const id = String(product.id).trim();
  const title = product.title.trim();
  if (!id || id.length > 80 || !title || title.length > 160) return null;

  let url: URL;
  try {
    url = new URL(product.url, marketOrigin);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.host !== new URL(marketOrigin).host) {
    url = new URL(url.pathname, marketOrigin);
  }

  let imageUrl: string | null = null;
  if (typeof product.image_url === "string" && product.image_url.trim()) {
    try {
      const image = new URL(product.image_url);
      if (image.protocol === "https:") imageUrl = image.toString();
    } catch {
      imageUrl = null;
    }
  }

  const images = Array.isArray(product.images)
    ? product.images.flatMap((value) => {
        if (typeof value !== "string" || !value.trim()) return [];
        try {
          const image = new URL(value);
          return image.protocol === "https:" ? [image.toString()] : [];
        } catch {
          return [];
        }
      })
    : [];
  if (!images.length && imageUrl) images.push(imageUrl);

  return {
    id,
    title,
    price: product.price,
    currency: product.currency.trim().slice(0, 8),
    image_url: imageUrl,
    ...(images.length ? { images } : {}),
    url: url.toString(),
    in_stock: product.in_stock,
  };
}

function errorResponse(message: string, status = 502, base?: string) {
  return NextResponse.json(
    { items: [], next_cursor: null, ...(base ? { base } : {}), error: message },
    { status },
  );
}

export async function GET(request: Request) {
  const baseUrl = process.env.MARKET_BASE_URL;
  const apiKey = process.env.MARKET_API_KEY;
  if (!baseUrl || !apiKey) {
    return errorResponse("Maestra Market is not configured yet.", 503);
  }

  let marketBase: URL;
  try {
    marketBase = new URL(baseUrl);
  } catch {
    return errorResponse("Maestra Market is not configured correctly.", 503);
  }
  if (marketBase.protocol !== "https:") {
    return errorResponse("Maestra Market is not configured correctly.", 503);
  }
  const base = marketBase.origin;

  const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor && cursor.length > MAX_CURSOR_LENGTH) {
    return errorResponse("Invalid product page cursor.", 400, base);
  }

  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor) params.set("cursor", cursor);

  try {
    const upstream = await fetch(`${base}/api/public/products?${params}`, {
      headers: { "x-api-key": apiKey },
      next: { revalidate },
    });
    if (!upstream.ok) {
      return errorResponse("Maestra Market products are temporarily unavailable.", 502, base);
    }

    let payload: unknown;
    try {
      payload = await upstream.json();
    } catch {
      return errorResponse("Maestra Market returned an invalid product response.", 502, base);
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return errorResponse("Maestra Market returned an invalid product response.", 502, base);
    }
    const response = payload as Record<string, unknown>;
    if (
      !Array.isArray(response.items) ||
      (response.next_cursor !== null && typeof response.next_cursor !== "string") ||
      (typeof response.next_cursor === "string" && response.next_cursor.length > MAX_CURSOR_LENGTH)
    ) {
      return errorResponse("Maestra Market returned an invalid product response.", 502, base);
    }

    const items = response.items
      .map((item) => readProduct(item, base))
      .filter((item): item is MarketProduct => item !== null);
    return NextResponse.json({
      items,
      next_cursor: response.next_cursor,
      base,
      ...(items.length === 0 ? { empty_message: "No products are available right now." } : {}),
    });
  } catch {
    return errorResponse("Maestra Market products are temporarily unavailable.", 502, base);
  }
}
