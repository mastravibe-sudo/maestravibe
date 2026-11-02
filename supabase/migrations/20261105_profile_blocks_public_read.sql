-- Restore visibility-aware reads of profile sections while preserving hidden-section privacy.
ALTER TABLE public.profile_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_blocks_owner_select" ON public.profile_blocks;
DROP POLICY IF EXISTS "profile_blocks_select_visible" ON public.profile_blocks;
CREATE POLICY "profile_blocks_select_visible"
ON public.profile_blocks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = profile_blocks.profile_id
      AND (
        p.id = auth.uid() OR
        p.visibility = 'public' OR
        (p.visibility = 'followers' AND EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = auth.uid() AND f.followed_id = p.id
        ))
      )
  )
  AND (
    profile_blocks.visibility = 'everyone' OR
    (profile_blocks.visibility = 'followers' AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.followed_id = profile_blocks.profile_id
    )) OR
    profile_blocks.profile_id = auth.uid()
  )
);

GRANT SELECT ON TABLE public.profile_blocks TO anon, authenticated;
