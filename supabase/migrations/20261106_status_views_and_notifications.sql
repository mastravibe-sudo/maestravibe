ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS status_id uuid REFERENCES public.statuses(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow', 'vibe', 'comment', 'profile_view', 'message', 'status'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_recipient_status_unique
  ON public.notifications (recipient_id, status_id);

CREATE INDEX IF NOT EXISTS idx_notifications_status_id
  ON public.notifications (status_id)
  WHERE status_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.status_views (
  status_id uuid NOT NULL REFERENCES public.statuses(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (status_id, viewer_id)
);

ALTER TABLE public.status_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_views_owner_read" ON public.status_views;
CREATE POLICY "status_views_owner_read"
ON public.status_views
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.statuses s
    WHERE s.id = status_views.status_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "status_views_viewer_insert" ON public.status_views;
CREATE POLICY "status_views_viewer_insert"
ON public.status_views
FOR INSERT TO authenticated
WITH CHECK (
  viewer_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.statuses s
    WHERE s.id = status_views.status_id
      AND s.user_id <> auth.uid()
      AND s.expires_at > now()
  )
);

REVOKE ALL ON TABLE public.status_views FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.status_views TO authenticated;

NOTIFY pgrst, 'reload schema';
