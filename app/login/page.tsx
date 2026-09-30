// path: maestra-vibe/app/login/page.tsx  (NEW file, app ke andar login folder banao)
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const field = "w-full rounded-xl border border-white/10 bg-zinc-800 px-4 py-3 outline-none focus:border-violet-500";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setMsg("");
    if (mode === "signup" && !/^[a-z0-9_]{3,20}$/.test(username)) {
      setMsg("Username must be 3-20 characters: lowercase letters, numbers and underscore only.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { data, error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { data: { username, name } } });
    setBusy(false);

    if (error) {
      setMsg(error.message.includes("Database error") ? "That username is already taken." : error.message);
      return;
    }
    if (mode === "signup" && !data.session) {
      setMsg("Account created. Check your email to confirm it, then log in.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900 p-6">
        <h1 className="font-serif text-3xl font-bold">{mode === "login" ? "Welcome back" : "Create your profile"}</h1>
        <p className="text-sm text-zinc-400">
          {mode === "login" ? "Log in to your Maestra Vibe account." : "Join Maestra Vibe and make it yours."}
        </p>

        {mode === "signup" && (
          <>
            <input className={field} placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
            <input
              className={field}
              placeholder="Username (e.g. ali_khan)"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
          </>
        )}
        <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className={field}
          type="password"
          placeholder="Password (6+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />

        {msg && <p className="text-sm text-amber-300">{msg}</p>}

        <button
          onClick={submit}
          disabled={busy}
          className="w-full rounded-full bg-violet-500 py-3 font-semibold text-white hover:bg-violet-400 disabled:opacity-50"
        >
          {busy ? "Please wait..." : mode === "login" ? "Log in" : "Sign up"}
        </button>

        <button
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setMsg("");
          }}
          className="w-full text-sm text-zinc-400 hover:text-white"
        >
          {mode === "login" ? "New here? Create an account" : "Already have an account? Log in"}
        </button>
      </div>
    </main>
  );
}