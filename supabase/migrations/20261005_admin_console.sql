-- Secure admin roles, account moderation, announcement broadcasts, and audit history.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_role text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_account_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_role_check
      CHECK (account_role IN ('user', 'admin')) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_account_status_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN ('pending', 'approved', 'suspended')) NOT VALID;
  END IF;
END;
$$;

-- Keep this admin migration safe to run even if the social sections migration has not run yet.
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('follow', 'vibe', 'comment')),
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  category text NOT NULL DEFAULT 'Other',
  price numeric(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  image_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at
  ON public.admin_audit_log (created_at DESC);

CREATE TABLE IF NOT EXISTS public.app_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  body text NOT NULL CHECK (char_length(body) BETWEEN 3 AND 2000),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_announcements_published
  ON public.app_announcements (published_at DESC);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND account_role = 'admin' AND account_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

  CREATE OR REPLACE FUNCTION public.is_account_approved()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND account_status = 'approved'
    );
  $$;

  CREATE OR REPLACE FUNCTION public.my_account_status()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $$
    SELECT account_status FROM public.profiles WHERE id = auth.uid();
  $$;

  REVOKE ALL ON FUNCTION public.is_account_approved() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.my_account_status() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.is_account_approved() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.my_account_status() TO authenticated;

  DO $$
  DECLARE
    table_name text;
  BEGIN
    FOREACH table_name IN ARRAY ARRAY[
      'profiles', 'profile_blocks', 'follows', 'posts', 'comments', 'vibes',
      'notifications', 'marketplace_listings', 'app_announcements', 'admin_audit_log'
    ] LOOP
      IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'active_account_gate_' || table_name, table_name);
        EXECUTE format(
          'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_account_approved()) WITH CHECK (public.is_account_approved())',
          'active_account_gate_' || table_name,
          table_name
        );
      END IF;
    END LOOP;
  END;
  $$;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit_admin_read" ON public.admin_audit_log;
CREATE POLICY "admin_audit_admin_read"
ON public.admin_audit_log
FOR SELECT
USING (public.is_admin());

ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announcements_public_read" ON public.app_announcements;
CREATE POLICY "announcements_public_read"
ON public.app_announcements
FOR SELECT
USING ((expires_at IS NULL OR expires_at > now()) OR public.is_admin());

DROP POLICY IF EXISTS "announcements_admin_insert" ON public.app_announcements;
CREATE POLICY "announcements_admin_insert"
ON public.app_announcements
FOR INSERT
WITH CHECK (public.is_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS "announcements_admin_update" ON public.app_announcements;
CREATE POLICY "announcements_admin_update"
ON public.app_announcements
FOR UPDATE
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "announcements_admin_delete" ON public.app_announcements;
CREATE POLICY "announcements_admin_delete"
ON public.app_announcements
FOR DELETE
USING (public.is_admin());

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_owner_read" ON public.notifications;
CREATE POLICY "notifications_owner_read"
ON public.notifications
FOR SELECT
USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_owner_update" ON public.notifications;
CREATE POLICY "notifications_owner_update"
ON public.notifications
FOR UPDATE
USING (recipient_id = auth.uid())
WITH CHECK (recipient_id = auth.uid());

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketplace_listings_public_read" ON public.marketplace_listings;
CREATE POLICY "marketplace_listings_public_read"
ON public.marketplace_listings
FOR SELECT
USING (status = 'active' OR seller_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_listings_owner_insert" ON public.marketplace_listings;
CREATE POLICY "marketplace_listings_owner_insert"
ON public.marketplace_listings
FOR INSERT
WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_listings_owner_update" ON public.marketplace_listings;
CREATE POLICY "marketplace_listings_owner_update"
ON public.marketplace_listings
FOR UPDATE
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "marketplace_listings_owner_delete" ON public.marketplace_listings;
CREATE POLICY "marketplace_listings_owner_delete"
ON public.marketplace_listings
FOR DELETE
USING (seller_id = auth.uid());

REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_audit_log TO authenticated;
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (read_at) ON TABLE public.notifications TO authenticated;
REVOKE ALL ON TABLE public.marketplace_listings FROM PUBLIC;
GRANT SELECT ON TABLE public.marketplace_listings TO anon, authenticated;
GRANT INSERT (seller_id, title, description, category, price, image_url)
  ON public.marketplace_listings TO authenticated;
GRANT UPDATE (title, description, category, price, image_url, status, updated_at)
  ON public.marketplace_listings TO authenticated;
GRANT DELETE ON TABLE public.marketplace_listings TO authenticated;
REVOKE ALL ON TABLE public.app_announcements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.app_announcements TO anon, authenticated;
GRANT INSERT (title, body, created_by, expires_at) ON public.app_announcements TO authenticated;
GRANT UPDATE (title, body, expires_at) ON public.app_announcements TO authenticated;
GRANT DELETE ON TABLE public.app_announcements TO authenticated;

DROP POLICY IF EXISTS "profiles_admin_read" ON public.profiles;
CREATE POLICY "profiles_admin_read"
ON public.profiles
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "posts_admin_read" ON public.posts;
CREATE POLICY "posts_admin_read"
ON public.posts
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "marketplace_admin_read" ON public.marketplace_listings;
CREATE POLICY "marketplace_admin_read"
ON public.marketplace_listings
FOR SELECT
USING (public.is_admin());

DROP POLICY IF EXISTS "notifications_admin_read" ON public.notifications;
CREATE POLICY "notifications_admin_read"
ON public.notifications
FOR SELECT
USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.admin_set_account_status(
  target_profile_id uuid,
  new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required.' USING ERRCODE = '42501';
  END IF;

  IF new_status NOT IN ('pending', 'approved', 'suspended') THEN
    RAISE EXCEPTION 'Invalid account status.' USING ERRCODE = '22023';
  END IF;

  IF target_profile_id = auth.uid() AND new_status <> 'approved' THEN
    RAISE EXCEPTION 'You cannot disable your own admin account.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.profiles
  SET account_status = new_status,
      updated_at = now()
  WHERE id = target_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_id, details)
  VALUES (auth.uid(), 'account_status_changed', target_profile_id, jsonb_build_object('status', new_status));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_post(target_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.posts WHERE id = target_post_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found.' USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_audit_log (actor_id, action, target_id)
  VALUES (auth.uid(), 'post_deleted', target_post_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_publish_announcement(
  announcement_title text,
  announcement_body text,
  announcement_expires_at timestamptz DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  announcement_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.app_announcements (title, body, created_by, expires_at)
  VALUES (announcement_title, announcement_body, auth.uid(), announcement_expires_at)
  RETURNING id INTO announcement_id;

  INSERT INTO public.admin_audit_log (actor_id, action, target_id, details)
  VALUES (auth.uid(), 'announcement_published', announcement_id, jsonb_build_object('title', announcement_title));

  RETURN announcement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_account_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_delete_post(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_publish_announcement(text, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_account_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_announcement(text, text, timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Promote the first administrator manually after running this migration:
-- UPDATE public.profiles SET account_role = 'admin' WHERE username = 'your_username';
