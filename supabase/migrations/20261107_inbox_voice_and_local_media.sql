ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS voice_url text
  CHECK (voice_url IS NULL OR voice_url LIKE 'https://%');

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_have_content;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_have_content
  CHECK (
    char_length(btrim(body)) > 0
    OR image_url IS NOT NULL
    OR voice_url IS NOT NULL
  );

GRANT INSERT (voice_url) ON TABLE public.messages TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_chat_media_delivered(p_message_id uuid)
RETURNS TABLE (image_url text, voice_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id uuid := auth.uid();
  message_sender uuid;
  message_conversation uuid;
  message_body text;
  stored_image_url text;
  stored_voice_url text;
BEGIN
  IF viewer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT m.sender_id, m.conversation_id, m.body, m.image_url, m.voice_url
  INTO message_sender, message_conversation, message_body, stored_image_url, stored_voice_url
  FROM public.messages m
  WHERE m.id = p_message_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF message_sender = viewer_id OR NOT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = message_conversation
      AND (c.participant_one = viewer_id OR c.participant_two = viewer_id)
  ) THEN
    RAISE EXCEPTION 'Only the recipient can mark chat media delivered';
  END IF;

  IF stored_image_url IS NOT NULL OR stored_voice_url IS NOT NULL THEN
    UPDATE public.messages
    SET body = CASE
          WHEN char_length(btrim(message_body)) > 0 THEN message_body
          WHEN stored_voice_url IS NOT NULL THEN 'Voice message'
          ELSE 'Photo'
        END,
        image_url = NULL,
        voice_url = NULL
    WHERE id = p_message_id;
  END IF;

  RETURN QUERY SELECT stored_image_url, stored_voice_url;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_chat_media_delivered(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_chat_media_delivered(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
