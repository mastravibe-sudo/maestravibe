// path: maestra-vibe/lib/supabase/client.ts  (NEW file)
// Browser (client components) mein Supabase ke liye
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}