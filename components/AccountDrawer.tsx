"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleHelp, Compass, LogOut, Settings, ShoppingBag, X } from "lucide-react";
import type { CurrentUserProfile } from "@/components/CurrentUserContext";
import GetAppButton from "@/components/GetAppButton";
import { createClient } from "@/lib/supabase/client";

export default function AccountDrawer({
  open,
  onClose,
  profile,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  profile: CurrentUserProfile | null;
  userId: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const signOut = async () => {
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    onClose();
    router.push("/login");
    router.refresh();
  };

  return (
    <div
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-0 z-[70] transition-colors duration-300 ${open ? "pointer-events-auto bg-black/65 opacity-100 backdrop-blur-sm" : "pointer-events-none bg-transparent opacity-0"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        role={open ? "dialog" : undefined}
        aria-modal={open || undefined}
        aria-labelledby="account-drawer-title"
        className={`flex h-full w-[min(86vw,22rem)] flex-col border-r border-white/10 bg-[#100d24] p-5 text-[#f4f2ff] shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <header className="mb-8 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-violet-600 to-blue-600 text-lg font-bold text-white">
                {(profile?.name || profile?.username || "M").slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <h2 id="account-drawer-title" className="truncate font-semibold">{profile?.name || "Maestra Vibe"}</h2>
              {profile?.username ? <p className="truncate text-sm text-violet-200/70">@{profile.username}</p> : null}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close menu" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <nav className="space-y-3">
          <Link href="/settings" onClick={onClose} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-white/10">
            <Settings className="h-5 w-5 text-violet-300" /> Settings
          </Link>
          <Link href="/discover" onClick={onClose} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-white/10">
            <Compass className="h-5 w-5 text-blue-300" /> Discover
          </Link>
          <Link href="/market" onClick={onClose} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-white/10">
            <ShoppingBag className="h-5 w-5 text-violet-300" /> Maestra Market
          </Link>
          <div className="flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 hover:bg-white/5">
            <span className="flex items-center gap-3 text-sm font-medium"><span className="text-lg text-blue-300" aria-hidden="true">↓</span> Get app</span>
            <GetAppButton />
          </div>
          <details className="group rounded-xl open:bg-white/[0.04]">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 text-sm font-medium hover:bg-white/10">
              <CircleHelp className="h-5 w-5 text-blue-300" /> Training / Help
            </summary>
            <div className="space-y-3 px-3 pb-4 pl-11 text-xs leading-relaxed text-white/65">
              <p>Choose For You to discover creators, or Following to catch up with your circle.</p>
              <p>Share a post from the composer, and use Vibe or comments to connect with creators.</p>
              <Link href="/friends" onClick={onClose} className="inline-flex min-h-9 items-center font-semibold text-violet-200 hover:text-white">Explore friends</Link>
            </div>
          </details>
          {userId ? (
            <button type="button" onClick={() => void signOut()} className="mt-3 flex min-h-12 w-full items-center gap-3 rounded-xl bg-linear-to-r from-[#7c3aed] to-[#2563eb] px-3 text-left text-sm font-semibold text-white shadow-lg shadow-violet-950/30">
              <LogOut className="h-5 w-5" /> Log out
            </button>
          ) : (
            <Link href="/login" onClick={onClose} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-violet-200 hover:bg-white/10">
              <LogOut className="h-5 w-5" /> Log in
            </Link>
          )}
        </nav>
        {error ? <p role="alert" className="mt-4 rounded-lg border border-pink-400/20 bg-pink-400/10 p-3 text-sm text-pink-100">{error}</p> : null}
      </aside>
    </div>
  );
}
