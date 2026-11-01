// path: maestra-vibe/components/AppShell.tsx  (poori file replace karo)
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, House, MessageCircle, ShoppingBag, User, Users, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthBox from "@/components/AuthBox";
import { CurrentUserContext, type CurrentUserProfile } from "@/components/CurrentUserContext";

// Apni public folder wali logo image ka naam yahan likho, jaise "/logo.png"
const LOGO_SRC = "/maestra-vibe-logo.svg";

type NavItem = { href: string; label: string; Icon: LucideIcon };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lightHome = false;
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const loadedUser = useRef(false);
  const reservedRoutes = new Set(["login", "notifications", "friends", "inbox", "market", "search", "admin", "account-access", "p"]);
  const routeParts = pathname.split("/").filter(Boolean);
  const standalone = pathname.startsWith("/admin") || (routeParts.length === 1 && !reservedRoutes.has(routeParts[0]));

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (standalone || loadedUser.current) return;
    loadedUser.current = true;
    let mounted = true;
    const supabase = createClient();
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) {
          setUserId(null);
          setProfile(null);
          setReady(true);
          setProfileReady(true);
        }
        return;
      }
      if (mounted) {
        setUserId(user.id);
        setReady(true);
      }
      const { data } = await supabase.from("profiles").select("id,username,name,bio,avatar_url").eq("id", user.id).maybeSingle();
      if (mounted) {
        setProfile((data as CurrentUserProfile | null) ?? null);
        setProfileReady(true);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [standalone]);

  const nav = useMemo<NavItem[]>(
    () => [
      { href: "/", label: "Home", Icon: House },
      { href: profile?.username ? `/${profile.username}` : "/login", label: "My Profile", Icon: User },
      { href: "/friends", label: "Friends", Icon: Users },
      { href: "/inbox", label: "Inbox", Icon: MessageCircle },
      { href: "/notifications", label: "Notifications", Icon: Bell },
      { href: "/market", label: "Maestra Market", Icon: ShoppingBag },
    ],
    [profile?.username]
  );

  return (
    <CurrentUserContext.Provider value={{ userId, profile, setProfile, ready, profileReady }}>
      {standalone ? children : <>
      <div className={`mx-auto flex min-h-screen max-w-7xl bg-[#09061a] text-[#f4f2ff]`}>
        {/* Left menu */}
        <aside className={`sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-2 border-r p-5 md:flex ${lightHome ? "border-slate-200 bg-white" : "border-white/10"}`}>
          <Link href="/" className="mb-6 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="" className="h-10 w-10 rounded-lg object-cover" />
            <span className={`bg-linear-to-r ${lightHome ? "from-violet-600 via-fuchsia-500 to-blue-500" : "from-violet-400 to-pink-400"} bg-clip-text text-xl font-extrabold text-transparent`}>Maestra Vibe</span>
          </Link>
          {nav.map(({ href, label, Icon }) => (
            <Link
              key={label}
              href={href}
              prefetch={true}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base transition ${lightHome ? "hover:bg-slate-50" : "hover:bg-white/10"} ${pathname === href ? (lightHome ? "bg-violet-50 font-semibold text-violet-700" : "bg-white/10 font-semibold") : lightHome ? "text-slate-500" : "text-zinc-400"}`}
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
      <nav className={`fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t px-1 py-2 backdrop-blur md:hidden ${lightHome ? "border-slate-200 bg-white/95" : "border-white/10 bg-[#0f0b24]/95"}`}>
        {nav.map(({ href, label, Icon }) => (
          <Link
            key={label}
            href={href}
            prefetch={true}
            className={`flex min-w-0 flex-col items-center gap-0.5 text-[10px] ${pathname === href ? (lightHome ? "font-semibold text-violet-700" : "text-white") : lightHome ? "text-slate-500" : "text-zinc-500"}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-full truncate">{label.replace("Maestra ", "")}</span>
          </Link>
        ))}
      </nav>
      </>}
    </CurrentUserContext.Provider>
  );
}