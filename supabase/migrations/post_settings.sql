
-- Fix repost permission validation in the posts INSERT policy.

DROP POLICY IF EXISTS "create own posts" ON public.posts;

CREATE POLICY "create own posts"
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    repost_of IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.posts AS original_post
      WHERE original_post.id = posts.repost_of
        AND (
          original_post.user_id = auth.uid()
          OR original_post.share_policy = 'everyone'
          OR (
            original_post.share_policy = 'followers'
            AND EXISTS (
              SELECT 1
              FROM public.follows AS f
              WHERE f.follower_id = auth.uid()
                AND f.followed_id = original_post.user_id
            )
          )
        )
    )
  )
);
