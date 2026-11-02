// path: maestra-vibe/app/robots.ts  (NEW file)
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/inbox", "/notifications", "/login", "/account-access", "/search"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}