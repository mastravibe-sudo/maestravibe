"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type AccountStatus = "pending" | "approved" | "suspended";
type AdminAccount = { id: string; username: string; name: string | null; account_status: AccountStatus; created_at: string };
type AdminPost = { id: string; type: string; body: string; created_at: string; profiles: { username: string; name: string | null } | null };
type AdminListing = { id: string; title: string; category: string; status: string; price: number; created_at: string };
type Announcement = { id: string; title: string; body: string; published_at: string };
type AuditEntry = { id: string; action: string; target_id: string | null; details: Record<string, unknown>; created_at: string };
type Counts = { accounts: number; posts: number; listings: number; announcements: number };

const labelClass = "mb-1.5 block text-xs font-medium text-zinc-400";
const inputClass = "w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-blue-400";
const statusTone: Record<AccountStatus, string> = {
  pending: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  approved: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  suspended: "border-red-400/20 bg-red-400/10 text-red-200",
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdminDashboard({ adminId }: { adminId: string }) {
  const [supabase] = useState(() => createClient());
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [counts, setCounts] = useState<Counts>({ accounts: 0, posts: 0, listings: 0, announcements: 0 });
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [accountResult, postResult, listingResult, announcementResult, auditResult, profileCount, postCount, listingCount] = await Promise.all([
      supabase.from("profiles").select("id,username,name,account_status,created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("posts").select("id,type,body,created_at,profiles!posts_user_id_fkey(username,name)").order("created_at", { ascending: false }).limit(12),
      supabase.from("marketplace_listings").select("id,title,category,status,price,created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("app_announcements").select("id,title,body,published_at").order("published_at", { ascending: false }).limit(8),
      supabase.from("admin_audit_log").select("id,action,target_id,details,created_at").order("created_at", { ascending: false }).limit(12),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("marketplace_listings").select("id", { count: "exact", head: true }),
    ]);

    const firstError = accountResult.error || postResult.error || listingResult.error || announcementResult.error || auditResult.error || profileCount.error || postCount.error || listingCount.error;
    if (firstError) setError(firstError.message);
    setAccounts((accountResult.data ?? []) as AdminAccount[]);
    setPosts((postResult.data ?? []) as unknown as AdminPost[]);
    setListings((listingResult.data ?? []) as AdminListing[]);
    setAnnouncements((announcementResult.data ?? []) as Announcement[]);
    setAudit((auditResult.data ?? []) as AuditEntry[]);
    setCounts({
      accounts: profileCount.count ?? 0,
      posts: postCount.count ?? 0,
      listings: listingCount.count ?? 0,
      announcements: announcementResult.data?.length ?? 0,
    });
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const changeStatus = async (account: AdminAccount, status: AccountStatus) => {
    setWorkingId(account.id);
    setError(null);
    setSuccess(null);
    const { error: actionError } = await supabase.rpc("admin_set_account_status", {
      target_profile_id: account.id,
      new_status: status,
    });
    if (actionError) setError(actionError.message);
    else {
      setSuccess(`@${account.username} is now ${status}.`);
      await load();
    }
    setWorkingId(null);
  };

  const removePost = async (post: AdminPost) => {
    if (!window.confirm("Delete this post permanently? This cannot be undone.")) return;
    setWorkingId(post.id);
    setError(null);
    const { error: actionError } = await supabase.rpc("admin_delete_post", { target_post_id: post.id });
    if (actionError) setError(actionError.message);
    else {
      setSuccess("Post deleted.");
      await load();
    }
    setWorkingId(null);
  };

  const publishAnnouncement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    const { data: announcementId, error: actionError } = await supabase.rpc("admin_publish_announcement", {
      announcement_title: title.trim(),
      announcement_body: body.trim(),
      announcement_expires_at: null,
    });
    if (actionError) setError(actionError.message);
    else {
      setTitle("");
      setBody("");
      let pushMessage = "The announcement was published.";
      try {
        const response = await fetch("/api/admin/push-announcement", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ announcementId }),
        });
        const result = await response.json() as { sent?: number; total?: number; error?: string };
        pushMessage = response.ok
          ? `Announcement published; push sent to ${result.sent ?? 0} of ${result.total ?? 0} opted-in devices.`
          : `Announcement published, but phone push could not be sent: ${result.error || "Check VAPID setup."}`;
      } catch {
        pushMessage = "Announcement published, but the push service could not be reached.";
      }
      setSuccess(pushMessage);
      await load();
    }
    setSaving(false);
  };

  const visibleAccounts = accounts.filter((account) => `${account.name ?? ""} ${account.username}`.toLowerCase().includes(search.toLowerCase()));
  const pendingCount = accounts.filter((account) => account.account_status === "pending").length;
  const suspendedCount = accounts.filter((account) => account.account_status === "suspended").length;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-7 pb-24 text-zinc-100 sm:px-6">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Maestra Vibe / Control room</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Admin dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Monitor accounts, community activity, and app updates.</p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-200">Admin session verified</span>
      </header>

      {error ? <p role="alert" className="mb-4 rounded-lg border border-red-400/20 bg-red-950/40 p-3 text-sm text-red-200">{error.includes("admin_") || error.includes("app_announcements") ? "Run the admin console SQL migration and verify your admin account is promoted." : error}</p> : null}
      {success ? <p role="status" className="mb-4 rounded-lg border border-emerald-400/20 bg-emerald-950/30 p-3 text-sm text-emerald-200">{success}</p> : null}

      <section aria-label="Application metrics" className="mb-7 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: "Total accounts", value: counts.accounts, note: `${pendingCount} pending review`, color: "text-blue-300" },
          { label: "Posts", value: counts.posts, note: "Community activity", color: "text-violet-300" },
          { label: "Market listings", value: counts.listings, note: "All seller listings", color: "text-emerald-300" },
          { label: "Suspended accounts", value: suspendedCount, note: `${counts.announcements} active updates`, color: "text-amber-300" },
        ].map((item) => (
          <article key={item.label} className="rounded-xl border border-white/10 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">{item.label}</p>
            <p className={`mt-2 text-3xl font-bold ${item.color}`}>{loading ? "—" : item.value}</p>
            <p className="mt-1 text-[11px] text-zinc-500">{item.note}</p>
          </article>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
              <div><h2 className="font-semibold text-white">Account review</h2><p className="mt-1 text-xs text-zinc-500">Approve, return to pending, or suspend accounts.</p></div>
              <input aria-label="Search accounts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search users" className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-blue-400 sm:w-56" />
            </div>
            <div className="max-h-130 overflow-auto">
              {visibleAccounts.length ? visibleAccounts.map((account) => (
                <article key={account.id} className="flex flex-wrap items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{account.name || account.username}</p><p className="truncate text-xs text-zinc-500">@{account.username} · {dateLabel(account.created_at)}</p></div>
                  <span className={`rounded-full border px-2 py-1 text-[10px] capitalize ${statusTone[account.account_status]}`}>{account.account_status}</span>
                  <div className="flex gap-1.5">
                    {account.account_status !== "approved" ? <button disabled={workingId === account.id} onClick={() => void changeStatus(account, "approved")} className="rounded-md bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50">Approve</button> : null}
                    {account.account_status !== "pending" ? <button disabled={workingId === account.id} onClick={() => void changeStatus(account, "pending")} className="rounded-md bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-medium text-amber-200 hover:bg-amber-500/25 disabled:opacity-50">Pending</button> : null}
                    {account.id !== adminId && account.account_status !== "suspended" ? <button disabled={workingId === account.id} onClick={() => void changeStatus(account, "suspended")} className="rounded-md bg-red-500/15 px-2.5 py-1.5 text-[11px] font-medium text-red-200 hover:bg-red-500/25 disabled:opacity-50">Suspend</button> : null}
                  </div>
                </article>
              )) : <p className="p-6 text-center text-sm text-zinc-500">{loading ? "Loading accounts..." : "No accounts match."}</p>}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
            <div className="border-b border-white/10 p-4"><h2 className="font-semibold text-white">Recent posts</h2><p className="mt-1 text-xs text-zinc-500">Latest community content; remove posts that violate policy.</p></div>
            <div className="divide-y divide-white/5">
              {posts.map((post) => (
                <article key={post.id} className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1"><p className="text-xs text-zinc-500">{post.profiles?.name || post.profiles?.username || "Unknown account"} · {post.type} · {dateLabel(post.created_at)}</p><p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-zinc-200">{post.body || "Image post"}</p></div>
                  <button disabled={workingId === post.id} onClick={() => void removePost(post)} className="shrink-0 rounded-md border border-red-400/20 px-2.5 py-1.5 text-xs text-red-200 hover:bg-red-500/10 disabled:opacity-50">Delete</button>
                </article>
              ))}
              {!posts.length ? <p className="p-5 text-sm text-zinc-500">{loading ? "Loading posts..." : "No posts yet."}</p> : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-white/10 bg-zinc-900">
            <div className="border-b border-white/10 p-4"><h2 className="font-semibold text-white">Market monitoring</h2><p className="mt-1 text-xs text-zinc-500">Newest listings and review status.</p></div>
            <div className="divide-y divide-white/5">
              {listings.map((listing) => <article key={listing.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-sm font-medium text-white">{listing.title}</p><p className="mt-1 text-xs text-zinc-500">{listing.category} · {dateLabel(listing.created_at)}</p></div><span className="rounded-full border border-white/10 px-2 py-1 text-[10px] capitalize text-zinc-300">{listing.status} · ${Number(listing.price).toFixed(2)}</span></article>)}
              {!listings.length ? <p className="p-5 text-sm text-zinc-500">{loading ? "Loading listings..." : "No market listings yet."}</p> : null}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <form onSubmit={publishAnnouncement} className="space-y-3 rounded-xl border border-white/10 bg-zinc-900 p-4">
            <div><h2 className="font-semibold text-white">Send app update</h2><p className="mt-1 text-xs text-zinc-500">Publish an announcement to users’ Notifications section.</p></div>
            <label className="block"><span className={labelClass}>Title</span><input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Planned maintenance" /></label>
            <label className="block"><span className={labelClass}>Message</span><textarea required minLength={3} maxLength={2000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} className={`${inputClass} resize-y`} placeholder="Write an update for the community" /></label>
            <button disabled={saving} className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? "Publishing..." : "Publish update"}</button>
          </form>

          <section className="rounded-xl border border-white/10 bg-zinc-900 p-4">
            <h2 className="font-semibold text-white">Published updates</h2>
            <div className="mt-3 space-y-3">
              {announcements.map((announcement) => <article key={announcement.id} className="border-l-2 border-blue-400 pl-3"><p className="text-sm font-medium text-zinc-200">{announcement.title}</p><p className="mt-1 line-clamp-3 text-xs text-zinc-500">{announcement.body}</p><p className="mt-1 text-[10px] text-zinc-600">{dateLabel(announcement.published_at)}</p></article>)}
              {!announcements.length ? <p className="text-xs text-zinc-500">{loading ? "Loading updates..." : "No updates published."}</p> : null}
            </div>
          </section>

          <section className="rounded-xl border border-white/10 bg-zinc-900 p-4">
            <h2 className="font-semibold text-white">Admin audit log</h2>
            <div className="mt-3 space-y-3">
              {audit.map((entry) => <article key={entry.id} className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-zinc-300">{entry.action.replaceAll("_", " ")}</p><p className="mt-1 text-[10px] text-zinc-600">Target: {entry.target_id || "—"}</p></div><time className="shrink-0 text-[10px] text-zinc-600">{dateLabel(entry.created_at)}</time></article>)}
              {!audit.length ? <p className="text-xs text-zinc-500">{loading ? "Loading log..." : "No admin actions recorded."}</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
