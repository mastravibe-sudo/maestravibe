// path: maestra-vibe/components/AppShell.tsx  (poori file replace karo)
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, Compass, House, Menu, MessageCircle, Plus, Search, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useUnreadCounts } from "@/lib/useUnreadCounts";
import { CurrentUserContext, type CurrentUserProfile } from "@/components/CurrentUserContext";
import PermissionOnboarding from "@/components/PermissionOnboarding";
import { subscribeWithRecovery } from "@/lib/supabase/realtime";
import AccountDrawer from "@/components/AccountDrawer";
import PostComposer from "@/components/PostComposer";

// Apni public folder wali logo image ka naam yahan likho, jaise "/logo.png"
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
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [activityToast, setActivityToast] = useState<ActivityToast | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const reservedRoutes = new Set(["login", "notifications", "friends", "inbox", "market", "discover", "settings", "search", "admin", "account-access", "p"]);
  const routeParts = pathname.split("/").filter(Boolean);
  const profileRoute = routeParts.length === 1 && !reservedRoutes.has(routeParts[0]);
  const standalone = pathname.startsWith("/admin");
  const hideAppChrome = pathname === "/login" || standalone;
  const { notificationCounts, unreadMessages } = useUnreadCounts(userId);

  useEffect(() => {
    if (!userId || standalone) return;

    let active = true;
    const supabase = createClient();
    const unsubscribe = subscribeWithRecovery({
      supabase,
      channelName: `activity-notifications-${userId}`,
      configure: (channel) => channel.on("postgres_changes", {
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
              ? activity.actorId ? `/inbox?user=${encodeURIComponent(activity.actorId)}` : "/inbox"
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
      }),
      onDisconnected: () => console.error("Realtime notifications remain disconnected after automatic retries."),
    });

    return () => {
      active = false;
      unsubscribe();
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
    const openComposer = () => setComposerOpen(true);
    window.addEventListener("mv:open-composer", openComposer);
    return () => window.removeEventListener("mv:open-composer", openComposer);
  }, []);

  useEffect(() => {
    if (standalone) return;
    let mounted = true;
    let profileRequest = 0;
    const supabase = createClient();
    const updateUser = (id: string | null) => {
      if (!mounted) return;
      const requestId = ++profileRequest;
      setUserId(id);
      setReady(true);
      if (!id) {
        setProfile(null);
        setProfileReady(true);
        return;
      }
      setProfileReady(false);
      void supabase.from("profiles").select("id,username,name,bio,avatar_url").eq("id", id).maybeSingle().then(({ data, error }) => {
        if (!mounted || requestId !== profileRequest) return;
        if (error) {
          console.error("Could not load the current user profile.", error.message);
          setProfile(null);
          setProfileReady(true);
          return;
        }
        setProfile((data as CurrentUserProfile | null) ?? null);
        setProfileReady(true);
      });
    };
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        console.error("Could not load the current session.", error.message);
        updateUser(null);
        return;
      }
      updateUser(data.user?.id ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        updateUser(session?.user.id ?? null);
      }, 0);
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [standalone]);

  const nav = useMemo<NavItem[]>(
    () => [
      { href: "/", label: "Home", Icon: House },
      { href: "/discover", label: "Discover", Icon: Compass },
      { href: "/inbox", label: "Inbox", Icon: MessageCircle },
      { href: profile?.username ? `/${profile.username}` : "/login", label: "Profile", Icon: User },
    ],
    [profile?.username]
  );

  return (
    <CurrentUserContext.Provider value={{ userId, profile, setProfile, ready, profileReady }}>
      {hideAppChrome ? children : <>
        <div className="mx-auto flex min-h-screen max-w-7xl bg-[#07061a] text-[#f4f2ff]">
          <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-2 border-r border-white/[0.06] p-5 md:flex">
            <Link href="/" className="mb-7 text-xl font-extrabold tracking-tight text-white">
              Maestra<span className="text-violet-400">Vibe</span>
            </Link>
            {nav.map(({ href, label, Icon }) => (
              <Link key={label} href={href} prefetch className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition hover:bg-white/5 ${pathname === href ? "bg-white/[0.07] font-semibold text-white" : "text-slate-300"}`}>
                <Icon className="h-5 w-5" />{label}
                {href === "/inbox" && visibleUnreadMessages > 0 ? <span className="ml-auto rounded-full bg-linear-to-r from-violet-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-white">{formatCount(visibleUnreadMessages)}</span> : null}
              </Link>
            ))}
            <Link href="/notifications" className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition hover:bg-white/5 ${pathname === "/notifications" ? "bg-white/[0.07] font-semibold text-white" : "text-slate-300"}`}>
              <Bell className="h-5 w-5" />Notifications
              {visibleNotificationCounts.total > 0 ? <span className="ml-auto rounded-full bg-linear-to-r from-violet-500 to-pink-500 px-2 py-0.5 text-[10px] font-bold text-white">{formatCount(visibleNotificationCounts.total)}</span> : null}
            </Link>
            <button type="button" onClick={() => setComposerOpen(true)} className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#7c3aed] to-[#2563eb] font-semibold text-white"><Plus className="h-5 w-5" />Create</button>
            <Link href="/market" className="mt-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-slate-300 hover:bg-white/5"><ShoppingBag className="h-5 w-5" />Maestra Market</Link>
          </aside>
          <div className="min-w-0 flex-1">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/[0.06] bg-[#07061a]/90 px-3 backdrop-blur sm:px-5">
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-200 hover:bg-white/10 md:hidden"><Menu className="h-5 w-5" /></button>
              <Link href="/" className="flex-1 text-lg font-extrabold tracking-tight text-white">Maestra<span className="text-violet-400">Vibe</span></Link>
              <Link href="/search" aria-label="Search" className="flex h-10 w-10 items-center justify-center rounded-full text-slate-200 hover:bg-white/10"><Search className="h-5 w-5" /></Link>
              <Link href="/notifications" aria-label={`Notifications${visibleNotificationCounts.total ? `, ${visibleNotificationCounts.total} unread` : ""}`} className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-200 hover:bg-white/10"><Bell className="h-5 w-5" /><CountBadge count={visibleNotificationCounts.total} /></Link>
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open account menu" className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#110f2e] text-sm font-bold text-white">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : (profile?.name || profile?.username || "M").slice(0, 1).toUpperCase()}
              </button>
            </header>
            <main className={`min-h-[calc(100dvh-3.5rem)] pb-20 md:pb-6 ${pathname === "/inbox" ? "overflow-hidden" : ""}`}>{children}</main>
          </div>
        </div>
        <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-5 border-t border-white/[0.06] bg-[#110f2e]/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          {nav.slice(0, 2).map(({ href, label, Icon }) => <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-1 text-[10px] ${pathname === href ? "text-white" : "text-slate-400"}`}><Icon className="h-5 w-5" />{label}</Link>)}
          <button type="button" onClick={() => setComposerOpen(true)} aria-label="Create post" className="mx-auto my-1 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-white shadow-lg shadow-violet-900/30"><Plus className="h-6 w-6" /></button>
          {nav.slice(2).map(({ href, label, Icon }) => <Link key={href} href={href} aria-label={href === "/inbox" && visibleUnreadMessages ? `Inbox, ${visibleUnreadMessages} unread` : label} className={`relative flex flex-col items-center justify-center gap-1 text-[10px] ${pathname === href || (label === "Profile" && profileRoute) ? "text-white" : "text-slate-400"}`}><span className="relative"><Icon className="h-5 w-5" />{href === "/inbox" ? <CountBadge count={visibleUnreadMessages} /> : null}</span>{label}</Link>)}
        </nav>
        <AccountDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} profile={profile} userId={userId} />
        {userId && composerOpen ? <PostComposer me={userId} onClose={() => setComposerOpen(false)} onPublished={() => { setComposerOpen(false); window.dispatchEvent(new Event("mv:post-published")); }} /> : null}
      </>}
      {activityToast && activityToast.userId === userId && !standalone ? (
        <div className="fixed bottom-20 right-4 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-white/15 bg-linear-to-r from-violet-600 to-pink-500 px-4 py-3 text-sm font-medium text-white shadow-xl md:bottom-5">
          <Link href={activityToast.href} onClick={() => setActivityToast(null)} className="flex min-w-0 items-center gap-3">
            <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{activityToast.message}</span>
          </Link>
          <button type="button" aria-label="Dismiss notification" onClick={() => setActivityToast(null)} className="ml-1 rounded-full p-1 text-white/80 hover:bg-white/15">×</button>
        </div>
      ) : null}
      {pathname !== "/login" && <PermissionOnboarding userId={userId} ready={ready} />}
    </CurrentUserContext.Provider>
  );
}