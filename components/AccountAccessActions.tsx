"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AccountAccessActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setBusy(true);
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setBusy(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="mt-6">
      {error ? <p role="alert" className="mb-3 text-sm text-red-300">{error}</p> : null}
      <button onClick={() => void signOut()} disabled={busy} className="rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50">
        {busy ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
