// path: maestra-vibe/components/AuthBox.tsx  (NEW file)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Me = { username: string; name: string | null; avatar_url: string | null };

export default function AuthBox({ light = false }: { light?: boolean }) {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setMe(null);
      const { data } = await supabase.from("profiles").select("username,name,avatar_url").eq("id", user.id).maybeSingle();
      if (!data) {
        setMe(null);
        return;
      }
      setMe({ username: data.username, name: data.name, avatar_url: data.avatar_url ?? null });
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      setTimeout(load, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (me === undefined) return null;
  if (!me)
    return (
      <Link
        href="/login"
        className={`mt-auto rounded-lg px-5 py-3 text-center font-semibold text-white ${light ? "bg-blue-600 hover:bg-blue-500" : "bg-violet-500 hover:bg-violet-400"}`}
      >
        Log in / Sign up
      </Link>
    );

  return (
    <div className={`mt-auto rounded-xl border p-3 ${light ? "border-slate-200 bg-white" : "border-white/10"}`}>
      <div className="flex items-center gap-2">
        {me.avatar_url ? (
          <img src={me.avatar_url} alt={me.name || me.username} className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ${light ? "bg-blue-600" : "bg-violet-500"}`}>
            {(me.name || me.username || "U").slice(0, 1).toUpperCase()}
          </div>
        )}
        <p className="font-medium">{me.name || me.username}</p>
      </div>
      <p className={`text-sm ${light ? "text-slate-500" : "text-zinc-500"}`}>@{me.username}</p>
      <button
        onClick={async () => {
          await createClient().auth.signOut();
          router.refresh();
        }}
        className={`mt-2 text-sm ${light ? "text-slate-500 hover:text-slate-900" : "text-zinc-400 hover:text-white"}`}
      >
        Log out
      </button>
    </div>
  );
}