// path: maestra-vibe/lib/site.ts  (NEW file)
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://maestravibe.vercel.app").replace(/\/$/, "");