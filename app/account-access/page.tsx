import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AccountAccessActions from "@/components/AccountAccessActions";

export default async function AccountAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isSuspended = status === "suspended";
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10 text-zinc-100">
      <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900 p-6 text-center shadow-2xl sm:p-8">
        <span className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full text-xl ${isSuspended ? "bg-red-500/15 text-red-300" : "bg-amber-500/15 text-amber-200"}`}>
          {isSuspended ? "!" : "…"}
        </span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">Maestra Vibe account</p>
        <h1 className="mt-2 text-2xl font-bold">{isSuspended ? "Account suspended" : "Approval pending"}</h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          {isSuspended
            ? "This account is currently suspended. Contact the Maestra Vibe team if you think this is a mistake."
            : "Your account is waiting for administrator approval. You can return after it has been approved."}
        </p>
        <AccountAccessActions />
      </section>
    </main>
  );
}
