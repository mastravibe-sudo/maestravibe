CREATE TABLE IF NOT EXISTS public.statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text text NOT NULL DEFAULT '' CHECK (char_length(text) <= 280),
  image_url text CHECK (image_url IS NULL OR image_url LIKE 'https://%'),
  music_url text CHECK (music_url IS NULL OR music_url LIKE 'https://%'),
  music_duration numeric(5, 2) CHECK (music_duration IS NULL OR music_duration BETWEEN 0 AND 30),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  CONSTRAINT statuses_have_content CHECK (char_length(btrim(text)) > 0 OR image_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_statuses_user_expiry_created
  ON public.statuses (user_id, expires_at, created_at DESC);

ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "statuses_author_or_followers_read" ON public.statuses;
CREATE POLICY "statuses_author_or_followers_read"
ON public.statuses
FOR SELECT TO authenticated
USING (
  expires_at > now()
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.follows f
      WHERE f.follower_id = auth.uid()
        AND f.followed_id = statuses.user_id
    )
  )
);

DROP POLICY IF EXISTS "statuses_owner_insert" ON public.statuses;
CREATE POLICY "statuses_owner_insert"
ON public.statuses
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "statuses_owner_delete" ON public.statuses;
CREATE POLICY "statuses_owner_delete"
ON public.statuses
FOR DELETE TO authenticated
USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.statuses FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.statuses TO authenticated;
GRANT INSERT (user_id, text, image_url, music_url, music_duration)
  ON TABLE public.statuses TO authenticated;
GRANT DELETE ON TABLE public.statuses TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'statuses'
    )
  THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.statuses;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
