-- Store only explicit user opt-ins for Web Push delivery.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_owner_read" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_owner_read"
ON public.push_subscriptions
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_owner_insert" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_owner_insert"
ON public.push_subscriptions
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_owner_update" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_owner_update"
ON public.push_subscriptions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_owner_delete" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_owner_delete"
ON public.push_subscriptions
FOR DELETE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "push_subscriptions_admin_read" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_admin_read"
ON public.push_subscriptions
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "push_subscriptions_admin_delete" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_admin_delete"
ON public.push_subscriptions
FOR DELETE
USING (public.is_admin());

DROP POLICY IF EXISTS "push_subscriptions_active_account_gate" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_active_account_gate"
ON public.push_subscriptions
AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.is_account_approved())
WITH CHECK (public.is_account_approved());

REVOKE ALL ON TABLE public.push_subscriptions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.push_subscriptions TO authenticated;
GRANT INSERT (user_id, endpoint, p256dh, auth)
  ON public.push_subscriptions TO authenticated;
GRANT UPDATE (p256dh, auth, updated_at)
  ON public.push_subscriptions TO authenticated;
GRANT DELETE ON TABLE public.push_subscriptions TO authenticated;

NOTIFY pgrst, 'reload schema';
