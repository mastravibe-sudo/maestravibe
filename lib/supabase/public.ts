// path: maestra-vibe/lib/supabase/public.ts  (NEW file)
// Bina login wala client: sirf wohi data parhta hai jo sab ko dikhna chahiye (sitemap, share pages).
import { createClient } from "@supabase/supabase-js";

export const publicClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });