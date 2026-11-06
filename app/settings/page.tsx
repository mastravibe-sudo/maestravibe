"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CircleHelp, Database, Globe2, Info, LogOut, Palette, Shield, UserRound } from "lucide-react";
import GetAppButton from "@/components/GetAppButton";
import PushSubscriptionControl from "@/components/PushSubscriptionControl";
import { useCurrentUser } from "@/components/CurrentUserContext";
import { createClient } from "@/lib/supabase/client";
import { clearCachedChatHistory } from "@/lib/inbox/local-store";

const row = "flex min-h-14 items-center gap-3 rounded-xl border border-white/[0.06] bg-[#110f2e] px-4";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, userId } = useCurrentUser();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const signOut = async () => {
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      return;
    }
    router.push("/login");
    router.refresh();
  };

  const clearChatCache = async () => {
    if (!window.confirm("Clear downloaded chat history and voice/photo files from this device? This does not delete messages from the server.")) return;
    setError("");
    setNotice("");
    try {
      await clearCachedChatHistory();
      setNotice("Local chat history cleared from this device.");
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Could not clear local chat history.");
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-2xl space-y-3 px-4 py-6 pb-24 text-[#f4f2ff] sm:px-6">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">Maestra Vibe</p>
        <h1 className="mt-2 text-3xl font-bold">Settings</h1>
      </header>
      {error ? <p role="alert" className="rounded-xl border border-pink-400/20 bg-pink-400/10 p-3 text-sm text-pink-100">{error}</p> : null}
      {notice ? <p role="status" className="rounded-xl border border-violet-300/15 bg-violet-500/10 p-3 text-sm text-violet-200">{notice}</p> : null}
      <Link href={profile ? `/${profile.username}?edit=1` : "/login"} className={`${row} hover:bg-white/[0.04]`}>
        <UserRound className="h-5 w-5 text-violet-300" /><span className="flex-1">Account &amp; Privacy</span><span aria-hidden="true">›</span>
      </Link>
      <section className={`${row} flex-wrap py-3`}>
        <Bell className="h-5 w-5 text-violet-300" /><div className="min-w-0 flex-1"><p>Notifications</p><p className="mt-1 text-xs text-[#a8a2c9]">Enable push alerts for messages and activity.</p></div>
        {userId ? <PushSubscriptionControl enabled /> : <Link href="/login" className="text-sm text-violet-300">Log in</Link>}
      </section>
      <details className="group rounded-xl border border-white/[0.06] bg-[#110f2e]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4"><Palette className="h-5 w-5 text-violet-300" /><span className="flex-1">Appearance</span><span className="text-xs text-[#a8a2c9]">Maestra dark</span></summary>
        <p className="px-12 pb-4 text-xs text-[#a8a2c9]">Maestra Vibe uses its signature dark-purple theme.</p>
      </details>
      <details className="group rounded-xl border border-white/[0.06] bg-[#110f2e]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4"><Globe2 className="h-5 w-5 text-violet-300" /><span className="flex-1">Language</span><span className="text-xs text-[#a8a2c9]">Device default</span></summary>
        <p className="px-12 pb-4 text-xs text-[#a8a2c9]">Language follows your browser settings.</p>
      </details>
      <details className="group rounded-xl border border-white/[0.06] bg-[#110f2e]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4"><Database className="h-5 w-5 text-violet-300" /><span className="flex-1">Data &amp; Storage</span><span className="text-xs text-[#a8a2c9]">Chat history</span></summary>
        <div className="space-y-3 px-4 pb-4 pl-12">
          <p className="text-xs text-[#a8a2c9]">Download a conversation from its Inbox screen, or clear cached chat files from this device.</p>
          <Link href="/inbox" className="inline-flex min-h-10 items-center rounded-full border border-white/10 px-4 text-xs font-semibold text-[#d7d2ef]">Open Inbox</Link>
          <button type="button" onClick={() => void clearChatCache()} className="ml-2 min-h-10 rounded-full border border-pink-300/20 px-4 text-xs font-semibold text-pink-200 hover:bg-pink-400/10">Clear local chat cache</button>
        </div>
      </details>
      <Link href={profile ? `/${profile.username}?edit=1` : "/login"} className={`${row} hover:bg-white/[0.04]`}>
        <Shield className="h-5 w-5 text-violet-300" /><span className="flex-1">Security</span><span aria-hidden="true">›</span>
      </Link>
      <details className="group rounded-xl border border-white/[0.06] bg-[#110f2e]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4"><Info className="h-5 w-5 text-violet-300" /><span className="flex-1">About MaestraVibe</span><span aria-hidden="true">›</span></summary>
        <p className="px-12 pb-4 text-xs text-[#a8a2c9]">A space for sharing your story and connecting through creativity.</p>
      </details>
      <Link href="/friends" className={`${row} hover:bg-white/[0.04]`}>
        <CircleHelp className="h-5 w-5 text-violet-300" /><span className="flex-1">Training / Help</span><span aria-hidden="true">›</span>
      </Link>
      <div className={`${row} justify-between`}>
        <span className="flex items-center gap-3"><span className="text-xl text-blue-300" aria-hidden="true">↓</span>Get app</span><GetAppButton />
      </div>
      {userId ? <button type="button" onClick={() => void signOut()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#7c3aed] to-[#2563eb] font-semibold text-white"><LogOut className="h-5 w-5" />Log out</button> : null}
    </main>
  );
}
