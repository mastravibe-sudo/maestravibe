CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_one uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_two uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_distinct_participants CHECK (participant_one < participant_two),
  CONSTRAINT conversations_participants_unique UNIQUE (participant_one, participant_two)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 4000),
  image_url text CHECK (image_url IS NULL OR image_url LIKE 'https://%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_have_content CHECK (char_length(btrim(body)) > 0 OR image_url IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.message_reads (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reader_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, reader_id)
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('follow', 'vibe', 'comment', 'profile_view', 'message'));

CREATE INDEX IF NOT EXISTS idx_conversations_participant_one_last_message
  ON public.conversations (participant_one, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_participant_two_last_message
  ON public.conversations (participant_two, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reads_conversation_reader
  ON public.message_reads (conversation_id, reader_id, read_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_message_id
  ON public.notifications (message_id)
  WHERE message_id IS NOT NULL;

DROP POLICY IF EXISTS "profiles_conversation_peer_read" ON public.profiles;
CREATE POLICY "profiles_conversation_peer_read"
ON public.profiles
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE (c.participant_one = auth.uid() AND c.participant_two = profiles.id)
       OR (c.participant_two = auth.uid() AND c.participant_one = profiles.id)
  )
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_participant_read" ON public.conversations;
CREATE POLICY "conversations_participant_read"
ON public.conversations
FOR SELECT TO authenticated
USING (auth.uid() = participant_one OR auth.uid() = participant_two);

DROP POLICY IF EXISTS "conversations_participant_create" ON public.conversations;
CREATE POLICY "conversations_participant_create"
ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = participant_one OR auth.uid() = participant_two)
  AND participant_one <> participant_two
);

DROP POLICY IF EXISTS "messages_participant_read" ON public.messages;
CREATE POLICY "messages_participant_read"
ON public.messages
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  )
);

DROP POLICY IF EXISTS "messages_participant_send" ON public.messages;
CREATE POLICY "messages_participant_send"
ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  )
);

DROP POLICY IF EXISTS "message_reads_participant_read" ON public.message_reads;
CREATE POLICY "message_reads_participant_read"
ON public.message_reads
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = message_reads.conversation_id
      AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  )
);

DROP POLICY IF EXISTS "message_reads_recipient_insert" ON public.message_reads;
CREATE POLICY "message_reads_recipient_insert"
ON public.message_reads
FOR INSERT TO authenticated
WITH CHECK (
  reader_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reads.message_id
      AND m.conversation_id = message_reads.conversation_id
      AND m.sender_id <> auth.uid()
      AND (c.participant_one = auth.uid() OR c.participant_two = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.set_conversation_last_message_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_update_conversation_last_message ON public.messages;
CREATE TRIGGER messages_update_conversation_last_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.set_conversation_last_message_at();

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
BEGIN
  SELECT CASE
    WHEN c.participant_one = NEW.sender_id THEN c.participant_two
    WHEN c.participant_two = NEW.sender_id THEN c.participant_one
    ELSE NULL
  END
  INTO recipient
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id;

  IF recipient IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, message_id)
    VALUES (recipient, NEW.sender_id, 'message', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_message_insert ON public.messages;
CREATE TRIGGER notifications_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

CREATE OR REPLACE FUNCTION public.get_inbox_conversation_summaries()
RETURNS TABLE (
  conversation_id uuid,
  participant_one uuid,
  participant_two uuid,
  last_message_at timestamptz,
  last_body text,
  last_image_url text,
  last_sender_id uuid,
  unread_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.participant_one,
    c.participant_two,
    c.last_message_at,
    latest.body,
    latest.image_url,
    latest.sender_id,
    (
      SELECT count(*)
      FROM public.messages unread_message
      WHERE unread_message.conversation_id = c.id
        AND unread_message.sender_id <> auth.uid()
        AND NOT EXISTS (
          SELECT 1
          FROM public.message_reads read_receipt
          WHERE read_receipt.message_id = unread_message.id
            AND read_receipt.reader_id = auth.uid()
        )
    )
  FROM public.conversations c
  LEFT JOIN LATERAL (
    SELECT m.body, m.image_url, m.sender_id
    FROM public.messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC, m.id DESC
    LIMIT 1
  ) latest ON true
  WHERE c.participant_one = auth.uid() OR c.participant_two = auth.uid()
  ORDER BY c.last_message_at DESC;
$$;

REVOKE ALL ON TABLE public.conversations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.messages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.message_reads FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT (participant_one, participant_two)
  ON TABLE public.conversations TO authenticated;
GRANT SELECT, INSERT (conversation_id, sender_id, body, image_url)
  ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT (conversation_id, message_id, reader_id)
  ON TABLE public.message_reads TO authenticated;
REVOKE ALL ON FUNCTION public.get_inbox_conversation_summaries() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_inbox_conversation_summaries() TO authenticated;
REVOKE ALL ON FUNCTION public.set_conversation_last_message_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_message() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'message_reads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
    END IF;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
