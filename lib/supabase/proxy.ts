// path: maestra-vibe/lib/supabase/proxy.ts  (NEW file)
// Har request par login session ko taaza (refresh) rakhta hai
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response; // keys set hone tak app chalti rahe

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(list) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getUser() session verify aur refresh karta hai. Yahan getSession() par bharosa mat karna.
  await supabase.auth.getUser();

  // Login banne ke baad yahan protected pages ka redirect lagayenge
  return response;
}