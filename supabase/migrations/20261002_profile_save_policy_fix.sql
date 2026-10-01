-- Repair the profile update policy for databases where the original migration was already run.
-- RLS WITH CHECK evaluates the new row; column grants protect verified from being changed.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS template text NOT NULL DEFAULT 'aurora',
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{
    "page": "#09090f",
    "pageAlt": "#17172a",
    "card": "rgba(17, 24, 39, 0.62)",
    "cardAlt": "rgba(255,255,255,0.08)",
    "text": "#f5f7ff",
    "textMuted": "#c4c9dc",
    "accent": "#8b5cf6",
    "accentSoft": "rgba(139,92,246,0.18)",
    "border": "rgba(255,255,255,0.12)",
    "buttonText": "#ffffff",
    "backgroundType": "gradient",
    "backgroundValue": "linear-gradient(135deg, #0f172a 0%, #1d4ed8 35%, #7c3aed 100%)",
    "radius": 24,
    "shadow": "0 20px 60px rgba(96, 76, 175, 0.28)",
    "fontHeading": "Inter",
    "fontBody": "Inter",
    "buttonStyle": "filled",
    "sectionSpacing": 24
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tagline'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET bio = tagline WHERE bio = '''' AND tagline IS NOT NULL';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id)
);

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

CREATE INDEX IF NOT EXISTS idx_follows_followed_id ON public.follows (followed_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public_or_owner" ON public.profiles;
CREATE POLICY "profiles_select_public_or_owner"
ON public.profiles
FOR SELECT
USING (
  id = auth.uid() OR visibility = 'public' OR (
    visibility = 'followers' AND EXISTS (
      SELECT 1 FROM public.follows f
      WHERE f.follower_id = auth.uid() AND f.followed_id = public.profiles.id
    )
  )
);

DROP POLICY IF EXISTS "profiles_owner_update" ON public.profiles;
CREATE POLICY "profiles_owner_update"
ON public.profiles
FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT UPDATE (
  username,
  name,
  bio,
  avatar_url,
  banner_url,
  template,
  theme,
  visibility,
  discoverable,
  updated_at
) ON public.profiles TO authenticated;
REVOKE UPDATE (verified) ON public.profiles FROM authenticated;

NOTIFY pgrst, 'reload schema';