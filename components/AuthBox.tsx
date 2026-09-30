// path: maestra-vibe/components/AuthBox.tsx  (NEW file)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Me = { username: string; name: string; avatar: string };

export default function AuthBox() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return setMe(null);
      const { data } = await supabase.from("profiles").select("username,name,avatar").eq("id", user.id).single();
      setMe(data);
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
        className="mt-auto rounded-full bg-violet-500 px-5 py-3 text-center font-semibold text-white hover:bg-violet-400"
      >
        Log in / Sign up
      </Link>
    );

  return (
    <div className="mt-auto rounded-xl border border-white/10 p-3">
      <p className="font-medium">
        {me.avatar} {me.name || me.username}
      </p>
      <p className="text-sm text-zinc-500">@{me.username}</p>
      <button
        onClick={async () => {
          await createClient().auth.signOut();
          router.refresh();
        }}
        className="mt-2 text-sm text-zinc-400 hover:text-white"
      >
        Log out
      </button>
    </div>
  );
}