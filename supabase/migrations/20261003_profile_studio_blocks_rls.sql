-- Let owners visually edit block layout and styling without unlocking or deleting locked blocks.
ALTER TABLE public.profile_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_blocks_owner_manage" ON public.profile_blocks;
DROP POLICY IF EXISTS "profile_blocks_owner_select" ON public.profile_blocks;
CREATE POLICY "profile_blocks_owner_select"
ON public.profile_blocks
FOR SELECT
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "profile_blocks_owner_insert" ON public.profile_blocks;
CREATE POLICY "profile_blocks_owner_insert"
ON public.profile_blocks
FOR INSERT
WITH CHECK (profile_id = auth.uid() AND locked = false);

DROP POLICY IF EXISTS "profile_blocks_owner_update" ON public.profile_blocks;
CREATE POLICY "profile_blocks_owner_update"
ON public.profile_blocks
FOR UPDATE
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "profile_blocks_owner_delete" ON public.profile_blocks;
CREATE POLICY "profile_blocks_owner_delete"
ON public.profile_blocks
FOR DELETE
USING (profile_id = auth.uid() AND locked = false);

GRANT SELECT ON TABLE public.profile_blocks TO authenticated;
GRANT INSERT (profile_id, type, position, width, config, style, visibility, locked)
  ON public.profile_blocks TO authenticated;
GRANT UPDATE (type, position, width, config, style, visibility)
  ON public.profile_blocks TO authenticated;
GRANT DELETE ON TABLE public.profile_blocks TO authenticated;
REVOKE UPDATE (locked) ON public.profile_blocks FROM authenticated;