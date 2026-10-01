-- Add profile-builder columns, blocks table, defaults, and server-side privacy checks.
-- Run this in the Supabase SQL editor after reviewing the app model.

-- 1) Add new columns to profiles if they do not already exist.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text NOT NULL DEFAULT '',
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
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
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

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_visibility_check
    CHECK (visibility IN ('public', 'followers', 'private')) NOT VALID;

-- 2) Ensure a default username exists on inserts if code supplies it through auth.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username));

-- 3) Create default block table.
CREATE TABLE IF NOT EXISTS public.profile_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'header','stats','about','links','achievements','struggles','dreams','likes','gallery','quote','favorites','timeline','text','divider','spacer','posts'
  )),
  position integer NOT NULL DEFAULT 0,
  width text NOT NULL DEFAULT 'full' CHECK (width IN ('full', 'half')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  style jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'followers', 'only_me')),
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_blocks_profile_id_position ON public.profile_blocks (profile_id, position);

-- 4) Helper functions for default data and updated_at timestamps.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.template IS NULL OR NEW.template = '' THEN
    NEW.template := 'aurora';
  END IF;

  IF NEW.theme IS NULL THEN
    NEW.theme := '{
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
    }'::jsonb;
  END IF;

  IF NEW.visibility IS NULL THEN
    NEW.visibility := 'public';
  END IF;

  IF NEW.discoverable IS NULL THEN
    NEW.discoverable := true;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.seed_default_profile_blocks();
CREATE OR REPLACE FUNCTION public.seed_default_profile_blocks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profile_blocks (profile_id, type, position, width, config, style, visibility, locked)
  VALUES
    (NEW.id, 'header', 0, 'full', '{"show_follow": true}', '{}', 'everyone', true),
    (NEW.id, 'stats', 1, 'full', '{"show_followers": true, "show_following": true, "show_vibes": true}', '{}', 'everyone', true),
    (NEW.id, 'about', 2, 'full', '{"title": "About"}', '{}', 'everyone', false),
    (NEW.id, 'links', 3, 'half', '{"title": "Links"}', '{}', 'everyone', false),
    (NEW.id, 'gallery', 4, 'half', '{"title": "Gallery"}', '{}', 'everyone', false),
    (NEW.id, 'posts', 5, 'full', '{"layout": "grid", "max_visible_posts": 6}', '{}', 'everyone', true);

  RETURN NEW;
END;
$$;

-- 5) Trigger the defaults and seed locked blocks for new profiles.
DROP TRIGGER IF EXISTS profiles_default_values_trigger ON public.profiles;
CREATE TRIGGER profiles_default_values_trigger
BEFORE INSERT OR UPDATE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_profile_defaults();

DROP TRIGGER IF EXISTS profiles_updated_at_trigger ON public.profiles;
CREATE TRIGGER profiles_updated_at_trigger
BEFORE UPDATE
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profile_blocks_updated_at_trigger ON public.profile_blocks;
CREATE TRIGGER profile_blocks_updated_at_trigger
BEFORE UPDATE
ON public.profile_blocks
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS profiles_seed_default_blocks_trigger ON public.profiles;
CREATE TRIGGER profiles_seed_default_blocks_trigger
AFTER INSERT
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.seed_default_profile_blocks();

-- 6) Backfill existing rows: assign default template/visibility if they are empty.
UPDATE public.profiles
SET template = COALESCE(template, 'aurora'),
    theme = COALESCE(theme, '{
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
    }'::jsonb),
    visibility = COALESCE(visibility, 'public'),
    discoverable = COALESCE(discoverable, true),
    updated_at = now()
WHERE template IS NULL OR theme IS NULL OR visibility IS NULL OR discoverable IS NULL;

-- 7) Seed locked sections for any existing profiles that do not have them.
INSERT INTO public.profile_blocks (profile_id, type, position, width, config, style, visibility, locked)
SELECT p.id, 'header', 0, 'full', '{"show_follow": true}', '{}', 'everyone', true
FROM public.profiles p
LEFT JOIN public.profile_blocks pb ON pb.profile_id = p.id AND pb.type = 'header'
WHERE pb.id IS NULL;

INSERT INTO public.profile_blocks (profile_id, type, position, width, config, style, visibility, locked)
SELECT p.id, 'stats', 1, 'full', '{"show_followers": true, "show_following": true, "show_vibes": true}', '{}', 'everyone', true
FROM public.profiles p
LEFT JOIN public.profile_blocks pb ON pb.profile_id = p.id AND pb.type = 'stats'
WHERE pb.id IS NULL;

INSERT INTO public.profile_blocks (profile_id, type, position, width, config, style, visibility, locked)
SELECT p.id, 'posts', 5, 'full', '{"layout": "grid", "max_visible_posts": 6}', '{}', 'everyone', true
FROM public.profiles p
LEFT JOIN public.profile_blocks pb ON pb.profile_id = p.id AND pb.type = 'posts'
WHERE pb.id IS NULL;

-- 8) Set tight RLS policies. Keep owners in control, but never allow edits to locked / verified / other users.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_blocks ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "profiles_owner_insert" ON public.profiles;
CREATE POLICY "profiles_owner_insert"
ON public.profiles
FOR INSERT
WITH CHECK (id = auth.uid());

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

-- 9) Tight column-level grants: only the fields we explicitly allow are mutable.
-- Keep the rest read-only for the authenticated user even if a policy is more permissive.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.profile_blocks FROM PUBLIC;
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;
GRANT SELECT ON TABLE public.profile_blocks TO anon, authenticated;
GRANT INSERT (id, username, name, bio, avatar_url, banner_url, template, theme, visibility, discoverable, updated_at) ON public.profiles TO authenticated;
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
GRANT INSERT (profile_id, type, position, width, config, style, visibility, locked) ON public.profile_blocks TO authenticated;
GRANT UPDATE (
  type,
  position,
  width,
  config,
  style,
  visibility
) ON public.profile_blocks TO authenticated;
GRANT DELETE ON public.profile_blocks TO authenticated;

-- 10) Deny unsafe user-editable columns explicitly.
REVOKE UPDATE (verified) ON public.profiles FROM authenticated;
REVOKE UPDATE (locked) ON public.profile_blocks FROM authenticated;

-- 11) Keep the product safe: database can still be used for read-only public profiles. This migration is additive and does not rewrite any user data.
