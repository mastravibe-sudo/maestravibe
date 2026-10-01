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

  const ensureProfile = async (userId: string, fallbackUsername: string, displayName: string) => {
    const supabase = createClient();
    const safeUsername = fallbackUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 20);
    const finalUsername = safeUsername || "user" + String(Date.now()).slice(-6);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();

    if (existingProfile) {
      return existingProfile.username;
    }

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        username: finalUsername,
        name: displayName || finalUsername,
        bio: "",
        avatar_url: null,
        banner_url: null,
        template: "aurora",
        theme: {
          page: "#09090f",
          pageAlt: "#17172a",
          card: "rgba(17, 24, 39, 0.62)",
          cardAlt: "rgba(255,255,255,0.08)",
          text: "#f5f7ff",
          textMuted: "#c4c9dc",
          accent: "#8b5cf6",
          accentSoft: "rgba(139,92,246,0.18)",
          border: "rgba(255,255,255,0.12)",
          buttonText: "#ffffff",
          backgroundType: "gradient",
          backgroundValue: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 35%, #7c3aed 100%)",
          radius: 24,
          shadow: "0 20px 60px rgba(96, 76, 175, 0.28)",
          fontHeading: "Inter",
          fontBody: "Inter",
          buttonStyle: "filled",
          sectionSpacing: 24,
        },
        visibility: "public",
        discoverable: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (error) {
      throw new Error(error.message);
    }

    return finalUsername;
  };

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

    const activeUser = data.user ?? (await supabase.auth.getUser()).data.user;
    if (!activeUser) {
      setMsg("Could not load your account. Please try again.");
      return;
    }

    if (mode === "signup" && !data.session) {
      setMsg("Account created. Check your email to confirm it, then log in.");
      return;
    }

    try {
      const resolvedUsername = await ensureProfile(activeUser.id, mode === "login" ? (email.split("@")[0] || "user") : username, mode === "login" ? activeUser.email?.split("@")[0] || "User" : name);
      router.push(`/${resolvedUsername}`);
      router.refresh();
    } catch (profileError) {
      const message = profileError instanceof Error ? profileError.message : "Could not create your profile.";
      setMsg(message);
    }
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