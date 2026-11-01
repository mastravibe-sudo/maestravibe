ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow', 'vibe', 'comment', 'profile_view'));

CREATE TABLE IF NOT EXISTS public.profile_view_notification_throttle (
  visitor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, profile_id),
  CHECK (visitor_id <> profile_id)
);

ALTER TABLE public.profile_view_notification_throttle ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profile_view_notification_throttle FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_profile_view_notification(p_viewer_id uuid, p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  IF p_viewer_id IS NULL OR p_profile_id IS NULL OR p_viewer_id = p_profile_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.profile_view_notification_throttle (visitor_id, profile_id, last_notified_at)
  VALUES (p_viewer_id, p_profile_id, now())
  ON CONFLICT (visitor_id, profile_id) DO UPDATE
    SET last_notified_at = EXCLUDED.last_notified_at
    WHERE profile_view_notification_throttle.last_notified_at <= now() - interval '24 hours';

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notifications (recipient_id, actor_id, type)
  VALUES (p_profile_id, p_viewer_id, 'profile_view')
  RETURNING id INTO notification_id;

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_profile_view_notification(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_profile_view_notification(uuid, uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
