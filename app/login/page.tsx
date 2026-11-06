// path: maestra-vibe/app/login/page.tsx  (NEW file, app ke andar login folder banao)
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const field = "w-full rounded-xl border border-white/10 bg-[#110f2e] px-4 py-3 text-[#f4f2ff] outline-none placeholder:text-[#817b9f] focus:border-violet-400";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  const resetPassword = async () => {
    setMsg("");
    if (!email.trim()) {
      setMsg("Enter your email address first.");
      return;
    }
    setBusy(true);
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` });
    setBusy(false);
    setMsg(error ? error.message : "If an account exists for this email, a password reset link is on its way.");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_#24114b_0%,_#07061a_58%)] px-4 py-10 text-[#f4f2ff]">
      <div className="pointer-events-none absolute -left-24 top-1/4 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="relative w-full max-w-md space-y-6">
        <header className="text-center">
          <img src="/maestra-vibe-logo.svg" alt="Maestra Vibe" className="mx-auto h-16 w-16" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Maestra<span className="text-violet-400">Vibe</span></h1>
          <p className="mt-2 text-sm text-[#c9c4e8]">More than a profile. A story of who you are.</p>
        </header>
        <section className="space-y-5 rounded-2xl border border-white/[0.06] bg-[#110f2e]/90 p-5 shadow-2xl backdrop-blur sm:p-7">
          <div className="flex rounded-full bg-[#07061a] p-1" role="tablist" aria-label="Account access">
            {(["login", "signup"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => { setMode(item); setMsg(""); }} className={`h-11 flex-1 rounded-full text-sm font-semibold ${mode === item ? "bg-linear-to-r from-[#7c3aed] to-[#2563eb] text-white" : "text-[#a8a2c9]"}`}>{item === "login" ? "Login" : "Sign Up"}</button>)}
          </div>
          <div>
            <h2 className="text-xl font-bold">{mode === "login" ? "Welcome back" : "Create your profile"}</h2>
            <p className="mt-1 text-sm text-[#a8a2c9]">{mode === "login" ? "Log in to your Maestra Vibe account." : "Join Maestra Vibe and make it yours."}</p>
          </div>

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
          <label className="relative block">
            <input
              className={`${field} pr-12`}
              type={showPassword ? "text" : "password"}
              placeholder="Password (6+ characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button type="button" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#a8a2c9] hover:bg-white/5">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </label>

          {mode === "login" ? <button type="button" onClick={() => void resetPassword()} disabled={busy} className="block text-sm font-medium text-violet-300 hover:text-violet-200 disabled:opacity-50">Forgot password?</button> : null}
          {msg && <p role="status" className="text-sm text-violet-200">{msg}</p>}

          <button onClick={submit} disabled={busy} className="w-full rounded-full bg-linear-to-r from-[#7c3aed] to-[#2563eb] py-3 font-semibold text-white shadow-lg shadow-violet-950/30 disabled:opacity-50">
            {busy ? "Please wait..." : mode === "login" ? "Login" : "Sign Up"}
          </button>

        </section>
      </div>
    </main>
  );
}