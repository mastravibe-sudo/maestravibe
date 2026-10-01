import { notFound, redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("account_role")
    .eq("id", user.id)
    .maybeSingle();

  if (error || profile?.account_role !== "admin") notFound();

  return <AdminDashboard adminId={user.id} />;
}
