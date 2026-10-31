// path: maestra-vibe/app/search/page.tsx  (NEW file)
import type { Metadata } from "next";
import SearchView from "@/components/SearchView";

export const metadata: Metadata = { title: "Search | Maestra Vibe", robots: { index: false } };

export default function SearchPage() {
  return <SearchView />;
}