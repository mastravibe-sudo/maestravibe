// path: maestra-vibe/app/market/page.tsx  (poori file replace karo; purani file ka backup rakh lo)
import type { Metadata } from "next";
import MaestraMarket from "@/components/MaestraMarket";

export const metadata: Metadata = { title: "Maestra Market", description: "Shop products from Maestra Market inside Maestra Vibe." };

export default function MarketPage() {
  return <MaestraMarket />;
}