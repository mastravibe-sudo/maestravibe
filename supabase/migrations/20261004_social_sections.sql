-- Backing tables and event triggers for notifications and the marketplace.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'follows' AND column_name = 'following_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'follows' AND column_name = 'followed_id'
  ) THEN
    ALTER TABLE public.follows RENAME COLUMN following_id TO followed_id;
  END IF;
END;
$$;

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

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON public.notifications (recipient_id, created_at DESC);

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

REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.notifications TO authenticated;
GRANT UPDATE (read_at) ON public.notifications TO authenticated;

CREATE OR REPLACE FUNCTION public.notify_new_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.follower_id <> NEW.followed_id THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type)
    VALUES (NEW.followed_id, NEW.follower_id, 'follow');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_new_post_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner uuid;
  notification_type text;
  comment_key uuid;
BEGIN
  SELECT user_id INTO post_owner FROM public.posts WHERE id = NEW.post_id;
  IF post_owner IS NOT NULL AND post_owner <> NEW.user_id THEN
    IF TG_TABLE_NAME = 'comments' THEN
      notification_type := 'comment';
      comment_key := NEW.id;
    ELSE
      notification_type := 'vibe';
      comment_key := NULL;
    END IF;

    INSERT INTO public.notifications (recipient_id, actor_id, type, post_id, comment_id)
    VALUES (post_owner, NEW.user_id, notification_type, NEW.post_id, comment_key);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_follow_insert ON public.follows;
CREATE TRIGGER notifications_follow_insert
AFTER INSERT ON public.follows
FOR EACH ROW EXECUTE FUNCTION public.notify_new_follow();

DROP TRIGGER IF EXISTS notifications_vibe_insert ON public.vibes;
CREATE TRIGGER notifications_vibe_insert
AFTER INSERT ON public.vibes
FOR EACH ROW EXECUTE FUNCTION public.notify_new_post_activity();

DROP TRIGGER IF EXISTS notifications_comment_insert ON public.comments;
CREATE TRIGGER notifications_comment_insert
AFTER INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.notify_new_post_activity();

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

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_active
  ON public.marketplace_listings (created_at DESC)
  WHERE status = 'active';

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

REVOKE ALL ON TABLE public.marketplace_listings FROM PUBLIC;
GRANT SELECT ON TABLE public.marketplace_listings TO anon, authenticated;
GRANT INSERT (seller_id, title, description, category, price, image_url)
  ON public.marketplace_listings TO authenticated;
GRANT UPDATE (title, description, category, price, image_url, status, updated_at)
  ON public.marketplace_listings TO authenticated;
GRANT DELETE ON TABLE public.marketplace_listings TO authenticated;

NOTIFY pgrst, 'reload schema';
