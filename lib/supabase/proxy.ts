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

  const { data: { user } } = await supabase.auth.getUser();
  if (user && request.nextUrl.pathname !== "/account-access") {
    const { data: accountStatus } = await supabase.rpc("my_account_status");

    if (accountStatus === "pending" || accountStatus === "suspended") {
      const status = accountStatus;
      if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: `Account ${status}. Contact an administrator.` }, { status: 403 });
      }

      const destination = new URL(`/account-access?status=${status}`, request.url);
      const blockedResponse = NextResponse.redirect(destination);
      response.cookies.getAll().forEach((cookie) => blockedResponse.cookies.set(cookie));
      return blockedResponse;
    }
  }

  return response;
}