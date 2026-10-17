// path: maestra-vibe/components/AppShell.tsx  (poori file replace karo)
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, House, ShoppingBag, User, Users, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthBox from "@/components/AuthBox";
import { useColorMode } from "@/lib/theme";

// Apni public folder wali logo image ka naam yahan likho, jaise "/logo.png"
const LOGO_SRC = "/maestra-vibe-logo.svg";

type NavItem = { href: string; label: string; Icon: LucideIcon };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { mode } = useColorMode();
  const lightHome = pathname === "/" && mode === "light";
  const [myUsername, setMyUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) setMyUsername(null);
        return;
      }
      const { data } = await supabase.from("profiles").select("username").eq("id", user.id).maybeSingle();
      if (mounted) setMyUsername(data?.username ?? null);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const nav = useMemo<NavItem[]>(
    () => [
      { href: "/", label: "Home", Icon: House },
      { href: myUsername ? `/${myUsername}` : "/login", label: "My Profile", Icon: User },
      { href: "/friends", label: "Friends", Icon: Users },
      { href: "/notifications", label: "Notifications", Icon: Bell },
      { href: "/market", label: "Maestra Market", Icon: ShoppingBag },
    ],
    [myUsername]
  );

  if (pathname.startsWith("/admin")) return <>{children}</>;

  return (
    <>
      <div className={`mx-auto flex min-h-screen max-w-7xl ${lightHome ? "bg-[#f4f7fb] text-slate-900" : ""}`}>
        {/* Left menu */}
        <aside className={`sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-2 border-r p-5 md:flex ${lightHome ? "border-slate-200 bg-white" : "border-white/10"}`}>
          <Link href="/" className="mb-6 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="" className="h-10 w-10 rounded-lg object-cover" />
            <span className={`bg-linear-to-r ${lightHome ? "from-blue-700 to-cyan-500" : "from-violet-400 to-pink-400"} bg-clip-text text-xl font-extrabold text-transparent`}>Maestra Vibe</span>
          </Link>
          {nav.map(({ href, label, Icon }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base transition ${lightHome ? "hover:bg-slate-50" : "hover:bg-white/10"} ${pathname === href ? (lightHome ? "bg-blue-50 font-semibold text-blue-700" : "bg-white/10 font-semibold") : lightHome ? "text-slate-500" : "text-zinc-400"}`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {label}
            </Link>
          ))}
          <AuthBox light={lightHome} />
        </aside>

        {/* Center */}
        <div className={`min-w-0 flex-1 pb-20 md:pb-0 ${lightHome ? "bg-[#f4f7fb]" : ""}`}>{children}</div>
      </div>

      {/* Mobile bottom nav */}
      <nav className={`fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t px-1 py-2 backdrop-blur md:hidden ${lightHome ? "border-slate-200 bg-white/95" : "border-white/10 bg-zinc-950/95"}`}>
        {nav.map(({ href, label, Icon }) => (
          <Link
            key={label}
            href={href}
            className={`flex min-w-0 flex-col items-center gap-0.5 text-[10px] ${pathname === href ? (lightHome ? "font-semibold text-blue-700" : "text-white") : lightHome ? "text-slate-500" : "text-zinc-500"}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-full truncate">{label.replace("Maestra ", "")}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}