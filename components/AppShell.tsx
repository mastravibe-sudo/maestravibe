// path: maestra-vibe/components/AppShell.tsx  (poori file replace karo)
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Flame, House, Mail, MessageCircle, MessageSquare, ShoppingBag, User, Users, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUnreadCounts } from "@/lib/useUnreadCounts";
import AuthBox from "@/components/AuthBox";
import { CurrentUserContext, type CurrentUserProfile } from "@/components/CurrentUserContext";
import PermissionOnboarding from "@/components/PermissionOnboarding";

// Apni public folder wali logo image ka naam yahan likho, jaise "/logo.png"
const LOGO_SRC = "/maestra-vibe-logo.svg";

type NavItem = { href: string; label: string; Icon: LucideIcon };
type NotificationKind = "vibe" | "comment" | "follow" | "message" | "profile_view";
type NotificationCounts = { vibe: number; comment: number; follow: number; message: number; total: number };
type ActivityToast = { id: string; userId: string; message: string; href: string };
const emptyCounts: NotificationCounts = { vibe: 0, comment: 0, follow: 0, message: 0, total: 0 };
const formatCount = (count: number) => count > 99 ? "99+" : String(count);
const CountBadge = ({ count }: { count: number }) => count > 0
  ? <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-pink-500 px-1 text-[9px] font-bold text-white">{formatCount(count)}</span>
  : null;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lightHome = false;
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [activityToast, setActivityToast] = useState<ActivityToast | null>(null);
  const loadedUser = useRef(false);
  const reservedRoutes = new Set(["login", "notifications", "friends", "inbox", "market", "search", "admin", "account-access", "p"]);
  const routeParts = pathname.split("/").filter(Boolean);
  const standalone = pathname.startsWith("/admin") || (routeParts.length === 1 && !reservedRoutes.has(routeParts[0]));
  const { notificationCounts, unreadMessages } = useUnreadCounts(userId);

  useEffect(() => {
    if (!userId || standalone) return;

    let active = true;
    const supabase = createClient();
    const channel = supabase
      .channel(`activity-notifications-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const row = (payload.new ?? {}) as {
          id?: string;
          type?: NotificationKind;
          actor_id?: string | null;
          post_id?: string | null;
        };
        if (payload.eventType === "INSERT" && row.id && row.actor_id !== userId &&
          (row.type === "vibe" || row.type === "comment" || row.type === "follow" || row.type === "message")) {
          const activity = {
            id: row.id,
            actorId: row.actor_id,
            type: row.type,
            postId: row.post_id,
          };
          void supabase.from("profiles").select("username,name").eq("id", activity.actorId ?? "").maybeSingle().then(({ data, error }) => {
            if (error) {
              console.error("Could not load notification actor.", error.message);
              return;
            }
            if (!active) return;
            const name = data?.name || (data?.username ? `@${data.username}` : "Someone");
            const href = activity.type === "message"
              ? "/inbox"
              : activity.type === "follow"
                ? data?.username ? `/${data.username}` : "/notifications"
                : activity.postId ? `/p/${activity.postId}` : "/notifications";
            setActivityToast({
              id: activity.id,
              userId,
              message: activity.type === "vibe"
                ? `${name} sent you a vibe`
                : activity.type === "comment"
                  ? `${name} commented on your post`
                  : activity.type === "follow"
                    ? `${name} followed you`
                    : `${name} sent you a message`,
              href,
            });
          });
        }
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Realtime notifications disconnected.", status);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [standalone, userId]);

  useEffect(() => {
    if (!activityToast) return;
    const timer = window.setTimeout(() => setActivityToast(null), 6000);
    return () => window.clearTimeout(timer);
  }, [activityToast]);

  const visibleNotificationCounts = userId && !standalone ? notificationCounts : emptyCounts;
  const visibleUnreadMessages = userId && !standalone ? unreadMessages : 0;
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
          {nav.map(({ href, label, Icon }) => href === "/inbox" ? (
            <Link key={label} href={href} prefetch={true} aria-label={`Inbox${visibleUnreadMessages ? `, ${visibleUnreadMessages} unread messages` : ""}`} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base transition ${lightHome ? "hover:bg-slate-50" : "hover:bg-white/10"} ${pathname === href ? (lightHome ? "bg-violet-50 font-semibold text-violet-700" : "bg-white/10 font-semibold") : lightHome ? "text-slate-500" : "text-zinc-400"}`}>
              <span className="relative"><Icon className="h-5 w-5 shrink-0" aria-hidden="true" /><CountBadge count={visibleUnreadMessages} /></span>
              {label}
            </Link>
          ) : href === "/notifications" ? (
            <div key={label} className="group relative">
              <Link href={href} prefetch={true} aria-label={`Notifications${visibleNotificationCounts.total ? `, ${visibleNotificationCounts.total} unread` : ""}`} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base transition ${lightHome ? "hover:bg-slate-50" : "hover:bg-white/10"} ${pathname === href ? (lightHome ? "bg-violet-50 font-semibold text-violet-700" : "bg-white/10 font-semibold") : lightHome ? "text-slate-500" : "text-zinc-400"}`}>
                <span className="relative"><Icon className="h-5 w-5 shrink-0" aria-hidden="true" />{visibleNotificationCounts.total ? <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-pink-500 px-1 text-[9px] font-bold text-white">{formatCount(visibleNotificationCounts.total)}</span> : null}</span>
                {label}
              </Link>
              {visibleNotificationCounts.total ? (
                <div className="pointer-events-none absolute left-10 top-full z-50 hidden w-52 rounded-xl border border-white/10 bg-[#17122b] p-3 shadow-xl group-hover:block group-focus-within:block">
                  <p className="mb-2 bg-linear-to-r from-violet-300 to-pink-300 bg-clip-text text-[10px] font-semibold uppercase tracking-wider text-transparent">Maestra Vibe activity</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-zinc-300"><Flame className="h-3.5 w-3.5 text-fuchsia-300" />Vibes <b className="ml-auto">{formatCount(visibleNotificationCounts.vibe)}</b></span>
                    <span className="flex items-center gap-1.5 text-zinc-300"><MessageSquare className="h-3.5 w-3.5 text-violet-300" />Comments <b className="ml-auto">{formatCount(visibleNotificationCounts.comment)}</b></span>
                    <span className="flex items-center gap-1.5 text-zinc-300"><Users className="h-3.5 w-3.5 text-pink-300" />Followers <b className="ml-auto">{formatCount(visibleNotificationCounts.follow)}</b></span>
                    <span className="flex items-center gap-1.5 text-zinc-300"><Mail className="h-3.5 w-3.5 text-purple-300" />Messages <b className="ml-auto">{formatCount(visibleNotificationCounts.message)}</b></span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
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
        {nav.map(({ href, label, Icon }) => href === "/inbox" ? (
          <Link key={label} href={href} prefetch={true} aria-label={`Inbox${visibleUnreadMessages ? `, ${visibleUnreadMessages} unread messages` : ""}`} className={`flex min-w-0 flex-col items-center gap-0.5 text-[10px] ${pathname === href ? (lightHome ? "font-semibold text-violet-700" : "text-white") : lightHome ? "text-slate-500" : "text-zinc-500"}`}>
            <span className="relative"><Icon className="h-5 w-5" aria-hidden="true" /><CountBadge count={visibleUnreadMessages} /></span>
            <span className="max-w-full truncate">{label}</span>
          </Link>
        ) : href === "/notifications" ? (
          <div key={label} className="group relative flex min-w-0 justify-center">
            <Link href={href} prefetch={true} aria-label={`Notifications${visibleNotificationCounts.total ? `, ${visibleNotificationCounts.total} unread` : ""}`} className={`flex min-w-0 flex-col items-center gap-0.5 text-[10px] ${pathname === href ? (lightHome ? "font-semibold text-violet-700" : "text-white") : lightHome ? "text-slate-500" : "text-zinc-500"}`}>
              <span className="relative"><Icon className="h-5 w-5" aria-hidden="true" />{visibleNotificationCounts.total ? <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-pink-500 px-1 text-[9px] font-bold text-white">{formatCount(visibleNotificationCounts.total)}</span> : null}</span>
              <span className="max-w-full truncate">{label}</span>
            </Link>
            {visibleNotificationCounts.total ? (
              <div className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 hidden w-52 rounded-xl border border-white/10 bg-[#17122b] p-3 shadow-xl group-hover:block group-focus-within:block">
                <p className="mb-2 bg-linear-to-r from-violet-300 to-pink-300 bg-clip-text text-[10px] font-semibold uppercase tracking-wider text-transparent">Maestra Vibe activity</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="flex items-center gap-1.5 text-zinc-300"><Flame className="h-3.5 w-3.5 text-fuchsia-300" />Vibes <b className="ml-auto">{formatCount(visibleNotificationCounts.vibe)}</b></span>
                  <span className="flex items-center gap-1.5 text-zinc-300"><MessageSquare className="h-3.5 w-3.5 text-violet-300" />Comments <b className="ml-auto">{formatCount(visibleNotificationCounts.comment)}</b></span>
                  <span className="flex items-center gap-1.5 text-zinc-300"><Users className="h-3.5 w-3.5 text-pink-300" />Followers <b className="ml-auto">{formatCount(visibleNotificationCounts.follow)}</b></span>
                  <span className="flex items-center gap-1.5 text-zinc-300"><Mail className="h-3.5 w-3.5 text-purple-300" />Messages <b className="ml-auto">{formatCount(visibleNotificationCounts.message)}</b></span>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
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
      {activityToast && activityToast.userId === userId && !standalone ? (
        <div className="fixed bottom-20 right-4 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-white/15 bg-linear-to-r from-violet-600 to-pink-500 px-4 py-3 text-sm font-medium text-white shadow-xl md:bottom-5">
          <Link href={activityToast.href} onClick={() => setActivityToast(null)} className="flex min-w-0 items-center gap-3">
            <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{activityToast.message}</span>
          </Link>
          <button type="button" aria-label="Dismiss notification" onClick={() => setActivityToast(null)} className="ml-1 rounded-full p-1 text-white/80 hover:bg-white/15">×</button>
        </div>
      ) : null}
      </>}
      <PermissionOnboarding userId={userId} ready={ready} />
    </CurrentUserContext.Provider>
  );
}